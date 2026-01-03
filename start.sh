#!/bin/bash

echo "--- 設定の入力 ---"
# -p だけにすることで、打ち込んだ文字がそのまま表示されます
read -p "ログインIDを入力してEnter: " my_id
read -p "パスワードを入力してEnter: " my_pass
echo ""

# R.js の ??? と !!! を入力内容で置き換えた実行用ファイルを作成
sed "s/???/$my_id/g; s/!!!/$my_pass/g" R.js > .run_temp.js

echo "--- ID: $my_id で起動します ---"
node .run_temp.js

# 終了時に一時ファイルを削除
rm .run_temp.js
