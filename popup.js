document.addEventListener('DOMContentLoaded', () => {
    // Grab elements
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusBadge = document.getElementById('statusBadge');
    const forceBtn = document.getElementById('forceRefreshBtn');
    const modeInputs = document.querySelectorAll('input[name="mode"]');

    // Debug check
    if (!toggleSwitch || !statusBadge || !forceBtn) {
        console.error("Adaptive Theme: Critical elements missing in popup!", {
            toggleSwitch, statusBadge, forceBtn
        });
        return; // Stop execution if elements are missing to avoid null errors
    }

    // Load current state
    chrome.storage.sync.get(['enabled', 'mode'], (result) => {
        // Handle case where result might be undefined (though rare)
        const isEnabled = result ? (result.enabled !== false) : true;
        const currentMode = (result && result.mode) ? result.mode : 'dark';

        if (toggleSwitch) toggleSwitch.checked = isEnabled;
        updateStatus(isEnabled);

        // Set mode radio
        const activeRadio = document.querySelector(`input[name="mode"][value="${currentMode}"]`);
        if (activeRadio) activeRadio.checked = true;
    });

    // Event Listeners
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', (e) => {
            saveState();
        });
    }

    modeInputs.forEach(input => {
        input.addEventListener('change', () => {
            saveState();
        });
    });

    if (forceBtn) {
        forceBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    const selectedModeEl = document.querySelector('input[name="mode"]:checked');
                    const selectedMode = selectedModeEl ? selectedModeEl.value : 'dark';

                    if (toggleSwitch.checked) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "force_process",
                            mode: selectedMode
                        });
                    }
                }
            });
        });
    }

    function saveState() {
        const isEnabled = toggleSwitch.checked;
        const selectedModeEl = document.querySelector('input[name="mode"]:checked');
        const selectedMode = selectedModeEl ? selectedModeEl.value : 'dark';

        chrome.storage.sync.set({ enabled: isEnabled, mode: selectedMode }, () => {
            updateStatus(isEnabled);
            // Send message to content script
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "toggle",
                        enabled: isEnabled,
                        mode: selectedMode
                    });
                }
            });
        });
    }

    function updateStatus(enabled) {
        if (!statusBadge) return;

        if (enabled) {
            statusBadge.textContent = "ON";
            statusBadge.classList.add('active');
        } else {
            statusBadge.textContent = "OFF";
            statusBadge.classList.remove('active');
        }
    }
});
