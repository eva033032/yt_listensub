# ListenSub

ListenSub 是 Chrome 擴充功能：YouTube 在原分頁播放，字幕在另一個獨立頁面顯示。字幕由使用者貼入，資料留在本機。

## 如何操作（Windows）

1. 在 Chrome 開啟 `chrome://extensions`，開啟「開發人員模式」。
2. 點「載入未封裝項目」，選取本專案資料夾。
3. 開啟 YouTube 影片，點工具列 ListenSub 圖示。
4. 貼上含時間碼的逐字稿，按「Use transcript」。例如：`[00:01:32] outside. So my morning I will`

逐字稿格式可參考：[YouTubeTranscript.com](https://youtubetotranscript.com/)

## 目前功能

- 顯示貼上的時間碼字幕，跟隨 YouTube 影片時間。
- 在字幕頁播放／暫停原 YouTube 影片。
- 調整字幕大小、選擇 YouTube 分頁、自動跟隨字幕。

## 尚未支援與限制

- 不會自動取得或產生字幕，需自行貼上逐字稿。
- 上一句／下一句跳轉目前尚未支援。
- 輸入時間跳轉目前尚未支援。
- YouTube 分頁需開啟且影片已載入；部分影片可能限制背景分頁控制。
