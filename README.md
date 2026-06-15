# Incan Gold / 印加寶藏 教學遊玩版

一個適合 3 至 8 位玩家、使用同一部裝置遊玩的網頁版。

系統負責寶石分配、災難配對、神器及五輪結算，毋須準備實體遊戲配件。

## 遊戲模式

- **遊戲主持人**：由一位主持人控制畫面，玩家用握拳／手掌同步示意，主持人一次過記錄全體選擇。
- **秘密交機**：玩家逐一接過裝置，私下選擇「繼續探索」或「回營入帳」。

主持人模式支援主持人同時參賽、先鎖定主持人答案、投票確認與修改、私人查看分數及撤銷上一個結算。

這是使用原創介面、圖示及文字製作的非官方教學遊玩版，不使用官方卡圖。

## 公開遊玩

[開啟 Incan Gold 網頁版](https://lv99slime.github.io/incan-gold/)

## 本機啟動

Windows 可雙擊 `start_incan_gold.bat`，或使用：

```powershell
npm install
npm run dev
```

開啟 `http://127.0.0.1:5173/`。

## 測試與打包

```powershell
npm test
npm run lint
npm run build
```

## 部署

推送到 GitHub `main` branch 後，`.github/workflows/deploy.yml` 會自動 build 並部署到 GitHub Pages。
