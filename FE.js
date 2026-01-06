/******************************************************
 * 表エンジン（抗争検知・iframe起動）
 ******************************************************/
(function() {
    if (window !== window.parent) return;

    const state = window.state;

    window.sendConfigToIframe = function() {
        if (!state.warIframe) return;
        state.warIframe.contentWindow.postMessage({
            type: 'WAR_CONFIG',
            payload: {
                repairEnabled: state.repairEnabled,
                equipMode: state.equipMode,
                targetHpName: state.targetHpName,
                delayMs: state.delayMs
            }
        }, '*');
    };

    function detectWarUI() {
        if (!location.href.includes('/war/member-list')) return;

        state.resetLogs();
        state.isWarActive = true;
        state.phase = 'IDLE';

        const enemyName = document.querySelector('.enemyTeamName')?.innerText || 'UNKNOWN';
        state.enemyName = enemyName;

        const iframe = document.createElement('iframe');
        iframe.src = location.href;
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';
        document.body.appendChild(iframe);

        state.warIframe = iframe;

        iframe.onload = () => window.sendConfigToIframe();
    }

    window.addEventListener('DOMContentLoaded', detectWarUI);
})();