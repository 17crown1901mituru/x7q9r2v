#!/bin/bash

# IDとパスワードの入力を求める（画面には表示されません）
echo "--- ログイン情報の入力 ---"
read -p "ログインID: " my_id
read -s -p "パスワード: " my_pass
echo ""

# R.js の ??? と !!! を一時的に書き換えたファイルを作成
# 元の R.js は汚さず、実行用のテンポラリファイルを作ります
sed "s/???/$my_id/g; s/!!!/$my_pass/g" R.js > .run_temp.js

echo "--- システムを起動します ---"
# 起動。終了時にテンポラリファイルを削除します
node .run_temp.js
rm .run_temp.js
