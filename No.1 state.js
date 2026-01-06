/******************************************************
 * Part 1：state 初期化（設定・ログ・保存機能）
 ******************************************************/
(function() {
    'use strict';

    const savedSettings = JSON.parse(localStorage.getItem('tmx_settings') || '{}');
    const savedLogs     = JSON.parse(localStorage.getItem('tmx_logs') || '{}');

    window.state = window.state || {
        // 設定
        repairEnabled: savedSettings.repairEnabled || false,
        equipMode:     savedSettings.equipMode     || 'N',
        targetHpName:  savedSettings.targetHpName  || 'FREE',
        delayMs:       savedSettings.delayMs !== undefined ? savedSettings.delayMs : 0,

        // 抗争状態
        phase:          'IDLE',
        availableItems: [],
        enemyName:      'UNKNOWN',
        teamId:         null,
        enemyTeamId:    null,
        isWarActive:    false,
        loggingActive:  false,
        warIframe:      null,
        lastResult:     null,

        // ログ
        logs: {
            front:   savedLogs.front   || [],
            action:  savedLogs.action  || [],
            traffic: savedLogs.traffic || []
        },

        // 設定保存
        saveSettings() {
            localStorage.setItem('tmx_settings', JSON.stringify({
                repairEnabled: this.repairEnabled,
                equipMode:     this.equipMode,
                targetHpName:  this.targetHpName,
                delayMs:       this.delayMs
            }));
        },

        // ログ保存
        saveLogs() {
            localStorage.setItem('tmx_logs', JSON.stringify({
                front:   this.logs.front,
                action:  this.logs.action,
                traffic: this.logs.traffic
            }));
        },

        // ログリセット
        resetLogs() {
            this.logs.front   = [];
            this.logs.action  = [];
            this.logs.traffic = [];
            this.saveLogs();
        }
    };

})();
