/* global CustomEvent */
function MultilingualTextXBlock(runtime, element) { // eslint-disable-line no-unused-vars
    'use strict';

    var root = element.querySelector ? element : element[0];
    var block = root.querySelector('.multilingual-text');
    if (!block) {
        return;
    }

    var dropdown = block.querySelector('.multilingual-text__dropdown');
    if (!dropdown) {
        return;
    }

    var trigger = dropdown.querySelector('.multilingual-text__trigger');
    var triggerValue = dropdown.querySelector('.multilingual-text__value');
    var listbox = dropdown.querySelector('.multilingual-text__options');
    var options = Array.prototype.slice.call(dropdown.querySelectorAll('.multilingual-text__option'));
    var courseId = block.getAttribute('data-course-id');
    var storageKey = 'multilingual_text:' + courseId + ':language';
    var eventName = 'multilingual-text:language-change';
    var panels = Array.prototype.slice.call(block.querySelectorAll('.multilingual-text__content'));
    var available = panels.map(function (panel) {
        return panel.getAttribute('data-language');
    });

    var cookieName = 'openedx-language-preference';
    var seenPrefKey = 'multilingual_text:' + courseId + ':seen_pref';

    function getPlatformLanguage() {
        try {
            var match = (document.cookie || '').match(/(?:^|;\s*)openedx-language-preference=([^;]+)/);
            if (match) {
                return decodeURIComponent(match[1]).toLowerCase();
            }
            if (window.parent && window.parent !== window) {
                var parentMatch = (window.parent.document.cookie || '').match(/(?:^|;\s*)openedx-language-preference=([^;]+)/);
                if (parentMatch) {
                    return decodeURIComponent(parentMatch[1]).toLowerCase();
                }
            }
        } catch (e) {
            // cookies unavailable or cross-origin iframe
        }
        return null;
    }

    function getOptionCandidates() {
        return options.map(function (option) {
            return {
                code: option.getAttribute('data-language-option'),
                label: (option.textContent || '').trim()
            };
        });
    }

    function matchLanguage(targetLang) {
        if (!targetLang) return null;
        var normTarget = String(targetLang).toLowerCase().replace('_', '-');
        var baseTarget = normTarget.split('-')[0];
        var candidates = getOptionCandidates();

        // 1. Direct code/tag exact match or prefix match
        for (var i = 0; i < candidates.length; i++) {
            var normCode = String(candidates[i].code || '').toLowerCase().replace('_', '-');
            if (normCode === normTarget || normCode === baseTarget || normCode.split(/[-_]/)[0] === baseTarget) {
                return candidates[i].code;
            }
        }

        // 2. Match against localized language display names (e.g. "Français", "French", "English", "Anglais")
        var names = [];
        try {
            if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
                var dnEn = new Intl.DisplayNames(['en'], { type: 'language' });
                var dnSelf = new Intl.DisplayNames([baseTarget], { type: 'language' });
                var addName = function (val) {
                    if (val) {
                        var low = val.toLowerCase();
                        if (names.indexOf(low) === -1) names.push(low);
                    }
                };
                addName(dnEn.of(baseTarget));
                addName(dnSelf.of(baseTarget));
                addName(dnEn.of(normTarget));
                addName(dnSelf.of(normTarget));
            }
        } catch (e) {
            // ignore Intl errors
        }

        // Common dictionary fallbacks in case Intl is unavailable or non-standard
        var fallbacks = {
            'fr': ['french', 'français', 'francais'],
            'en': ['english', 'anglais'],
            'es': ['spanish', 'español', 'espanol'],
            'de': ['german', 'deutsch']
        };
        if (fallbacks[baseTarget]) {
            fallbacks[baseTarget].forEach(function (n) {
                if (names.indexOf(n) === -1) names.push(n);
            });
        }

        for (var j = 0; j < candidates.length; j++) {
            var label = (candidates[j].label || '').toLowerCase();
            var code = (candidates[j].code || '').toLowerCase();
            for (var k = 0; k < names.length; k++) {
                var n = names[k];
                if (label === n || label.indexOf(n) === 0 || n.indexOf(label) === 0 ||
                    code === n || code.indexOf(n) === 0 || n.indexOf(code) === 0) {
                    return candidates[j].code;
                }
            }
        }

        return null;
    }

    function storedLanguage() {
        var platform = getPlatformLanguage();
        var lastSeen = null;
        try {
            lastSeen = window.localStorage.getItem(seenPrefKey);
        } catch (e) {}

        // If the platform preference changed since last visit, update to it if available
        if (platform && platform !== lastSeen) {
            try {
                window.localStorage.setItem(seenPrefKey, platform);
            } catch (e) {}
            var matched = matchLanguage(platform);
            if (matched) {
                remember(matched);
                return matched;
            }
        }

        try {
            return window.localStorage.getItem(storageKey);
        } catch (error) {
            return null;
        }
    }

    function remember(language) {
        try {
            window.localStorage.setItem(storageKey, language);
        } catch (error) {
            // Browser privacy settings may disable localStorage; switching still works.
        }
    }

    function show(language) {
        var selected = available.indexOf(language) === -1 ? available[0] : language;
        options.forEach(function (option) {
            var isSelected = option.getAttribute('data-language-option') === selected;
            option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            option.classList.toggle('multilingual-text__option--selected', isSelected);
            if (isSelected) {
                triggerValue.textContent = option.textContent;
            }
        });
        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-language') !== selected;
        });
        return selected;
    }

    function closeDropdown(returnFocus) {
        listbox.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        block.style.minHeight = '';
        if (returnFocus) {
            trigger.focus();
        }
    }

    function openDropdown() {
        listbox.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        var blockRect = block.getBoundingClientRect();
        var overflow = listbox.getBoundingClientRect().bottom - blockRect.bottom;
        if (overflow > 0) {
            block.style.minHeight = blockRect.height + overflow + 'px';
        }
        (options.find(function (option) {
            return option.getAttribute('aria-selected') === 'true';
        }) || options[0]).focus();
    }

    function choose(language) {
        var selected = show(language);
        remember(selected);
        window.dispatchEvent(new CustomEvent(eventName, {
            detail: {courseId: courseId, language: selected},
        }));
    }

    show(storedLanguage());

    trigger.addEventListener('click', function () {
        if (listbox.hidden) {
            openDropdown();
        } else {
            closeDropdown(true);
        }
    });

    options.forEach(function (option) {
        option.addEventListener('click', function () {
            choose(option.getAttribute('data-language-option'));
            closeDropdown(true);
        });
    });

    listbox.addEventListener('keydown', function (event) {
        var index = options.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            index = event.key === 'ArrowDown'
                ? (index + 1) % options.length
                : (index - 1 + options.length) % options.length;
            options[index].focus();
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            options[event.key === 'Home' ? 0 : options.length - 1].focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeDropdown(true);
        } else if (event.key === 'Tab') {
            closeDropdown(false);
        }
    });

    trigger.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openDropdown();
        }
    });

    document.addEventListener('click', function (event) {
        if (!dropdown.contains(event.target)) {
            closeDropdown(false);
        }
    });

    window.addEventListener(eventName, function (event) {
        if (event.detail && event.detail.courseId === courseId) {
            show(event.detail.language);
        }
    });
}
