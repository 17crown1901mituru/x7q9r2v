// ==UserScript==
// @name         Tantora Recovery Engine (Unified)
// @namespace    https://viayoo.com/ekt6gu
// @version      1.0.0
// @match        https://tantora.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/******************************************************
 * 共通 state 初期化
 ******************************************************/
(function() {
    const STORAGE_KEY_SETTINGS = 'tmx_settings';
    const STORAGE_KEY_LOGS     = 'tmx_logs';

    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    const savedLogs     = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '{}');

    window.state = {
        repairEnabled: savedSettings.repairEnabled || false,
        equipMode:     savedSettings.equipMode     || 'N',
        targetHpName:  savedSettings.hpName        || 'FREE',
        delayMs:       savedSettings.delayMs !== undefined ? savedSettings.delayMs : 0,

        phase: 'IDLE',
        availableItems: [],
        enemyName: 'UNKNOWN',
        isWarActive: false,
        warIframe: null,

        logs: {
            front:   savedLogs.front   || [],
            action:  savedLogs.action  || [],
            traffic: savedLogs.traffic || []
        },

        saveSettings() {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
                repairEnabled: this.repairEnabled,
                equipMode:     this.equipMode,
                hpName:        this.targetHpName,
                delayMs:       this.delayMs
            }));
        },

        resetLogs() {
            this.logs.front   = [];
            this.logs.action  = [];
            this.logs.traffic = [];
        }
    };
})();

/******************************************************
 * ▼▼▼ UI（右上パネル）ここに ui.js を貼る ▼▼▼
 ******************************************************/

// --- ui.js をここに貼り付ける ---



/******************************************************
 * ▼▼▼ FE（Front Engine：抗争検知・iframe起動）ここに frontEngine.js を貼る ▼▼▼
 ******************************************************/

// --- frontEngine.js をここに貼り付ける ---



/******************************************************
 * ▼▼▼ BE（Back Engine：回復・修理・ST/SP・終了判定）ここに backEngine.js を貼る ▼▼▼
 ******************************************************/

// --- backEngine.js をここに貼り付ける ---



/******************************************************
 * ▼▼▼ SM（Session Manager：セッション保存・最大4件管理）ここに sessionManager.js を貼る ▼▼▼
 ******************************************************/

// --- sessionManager.js をここに貼り付ける ---



/******************************************************
 * ▼▼▼ LV（Log Viewer：別タブログビュー）ここに logViewer.js を貼る ▼▼▼
 ******************************************************/

// --- logViewer.js をここに貼り付ける ---