# 台灣天氣圖鑑 | Taiwan Weather Atlas

**中央氣象署真實資料 × 鄉鎮 GIS × 七日預報**

> 用程式探索天氣、用資料看見台灣、用 AI 實現更多可能  
> Code Smarter · Build a Better Tomorrow

**技術棧：** CWA Open Data × Python × Pandas × SQLite × FastAPI × Leaflet

與你一起用 AI 寫程式，探索更大的世界。

> 「技術可以解決問題，但更重要的是用技術創造更好的未來！」  
> — 煥哥

---

## 專案簡介

本專案對應「AI 創新微課程」實作路線：**AI × 資料 × 天氣 × 實作**。  
從中央氣象署（CWA）取得全台 22 個縣市的一週鄉鎮預報，整理平均／最高／最低溫、天氣現象與降雨機率至 SQLite，並以 Leaflet、OpenStreetMap 和台灣鄉鎮 GeoJSON 呈現互動地圖、折線圖與每日預報表。

| 面向 | 內容 |
|------|------|
| 資料來源 | 22 個 CWA `F-D0047` 官方一週鄉鎮預報 dataset |
| 地圖範圍 | 22 個縣市、368 個鄉鎮市區 |
| 專案成果 | Taiwan Weather Atlas（互動式七日天氣 GIS） |

## 本機執行

需求：Python 3.12 以上。將 CWA API Key 放在根目錄 `.env` 的 `CWA_API_KEY` 欄位；`.env` 已列入 Git 忽略規則。

```powershell
python -m pip install -r requirements.txt
python -m weather_data --refresh
python -m uvicorn app:app --reload
```

開啟 `http://127.0.0.1:8000`。資料刷新會呼叫 22 個官方 dataset；全部成功並通過全台覆蓋檢查後才會以 upsert 寫入 `data.db`。本機 SQLite 資料庫不納入 Git。

執行整合測試（需先完成一次真實資料刷新）：

```powershell
python -m unittest discover -s tests -v
```

## Dashboard

- 依日期、縣市與鄉鎮篩選台灣行政區地圖。
- 以色階查看平均溫度、最高溫、最低溫或降雨機率。
- 選取鄉鎮後顯示七日高低溫曲線、天氣現象、降雨機率與每日表格。
- API 每五小時檢查 CWA 更新；CWA 來源約每六小時發布一次。
- 天氣資料先寫入 `TemperatureForecasts` SQLite 表，再由 dashboard API 讀取。

健康檢查：`/api/health`。預報 API：`/api/forecast`，支援 `county`、`region`、`date` 篩選。

---

## 學習地圖（24 步）

### 基礎與資料來源

| # | 單元 | 重點 |
|---|------|------|
| 1 | **課程介紹** | 課程目標、學習地圖、專案成果展示 |
| 2 | **台灣的天氣與生活** | 天氣影響生活、資料驅動決策、智慧應用案例 |
| 3 | **中央氣象署 CWA Open Data 平台** | 註冊帳號、取得 API Key、選擇資料集 |
| 4 | **API 資料取得** | 使用 `requests` 取得 JSON（Authorization header） |

### 資料處理與資料庫

| # | 單元 | 重點 |
|---|------|------|
| 5 | **JSON 資料結構解析** | 找到氣溫位置：`locations` → `weatherElement` → `MinT` / `MaxT` |
| 6 | **提取最高與最低氣溫** | 解析 JSON、提取 MinT / MaxT、轉成結構化資料 |
| 7 | **資料整理與預覽** | 使用 Pandas 觀察資料（地區、日期、mint、maxt） |
| 8 | **建立 SQLite 資料庫** | `data.db`：建立資料庫、建立資料表、插入氣溫資料 |
| 9 | **資料庫設計 TemperatureForecasts** | `id`, `regionName`, `dataDate`, `mint`, `maxt` |
| 10 | **查詢資料驗證** | 用 SQL 檢查資料（例如依地區篩選） |

### 互動式 Web App

| # | 單元 | 重點 |
|---|------|------|
| 11 | **FastAPI 入門** | Python API 與 Web App 基本結構 |
| 12 | **從資料庫讀取資料** | `sqlite3` + Pandas + FastAPI |
| 13 | **下拉選單選擇地區** | 互動式選擇縣市與鄉鎮 |
| 14 | **繪製折線圖** | 一週最高與最低氣溫（MaxT / MinT） |
| 15 | **顯示資料表格** | 清楚呈現一週預報（Date、MinT、MaxT） |
| 16 | **整合 Web App 介面** | Taiwan Weather Atlas：選地區看氣溫週報 |

### 進階視覺化與成果

| # | 單元 | 重點 |
|---|------|------|
| 17 | **進階：台灣地圖視覺化** | Leaflet + OpenStreetMap；依預報要素著色 |
| 18 | **選擇日期顯示地圖** | 互動式天氣地圖（選定日期顯示該日 Min / Max） |
| 19 | **完整成果展示** | Taiwan Weather Dashboard |
| 20 | **程式碼品質與優化** | 結構清晰、錯誤處理、重複執行不重複插入、良好註解 |

### 版本控管與延伸

| # | 單元 | 重點 |
|---|------|------|
| 21 | **專案上傳至 GitHub** | 建立 Repository、連遠端、Commit & Push |
| 22 | **延伸應用與想法** | 天氣提醒 Line Bot、旅遊行程建議、農業／防災應用、結合 AI 做分析 |
| 23 | **回顧與重點整理** | API 資料取得、JSON 資料分析、SQLite 資料庫、FastAPI Web App、AI × Coding 實作流程 |
| 24 | **下一步：繼續探索** | 更多公開資料 API、資料視覺化應用、AI 協助開發、打造自己的專案作品 |

---

## 資料庫設計

資料表名稱：`TemperatureForecasts`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | INTEGER PRIMARY KEY | 主鍵 |
| `countyName` | TEXT | 縣市名稱 |
| `regionName` | TEXT | 鄉鎮市區名稱 |
| `geocode` | TEXT | CWA 鄉鎮代碼；與日期組成唯一鍵 |
| `dataDate` | TEXT | 預報日期 |
| `t` | REAL | 日平均溫度 |
| `mint` | REAL | 每日最低氣溫 |
| `maxt` | REAL | 每日最高氣溫 |
| `wx` | TEXT | 天氣現象 |
| `pop` | REAL | 12 小時分段降雨機率的日最大值 |
| `latitude`, `longitude` | REAL | CWA 鄉鎮座標 |
| `sourceDataset` | TEXT | 官方資料集 ID |
| `updatedAt` | TEXT | 資料寫入時間 |

唯一約束：`UNIQUE (geocode, dataDate)`，重複刷新使用 SQLite `ON CONFLICT DO UPDATE`。

---

## 查詢範例

```sql
SELECT DISTINCT regionName
FROM TemperatureForecasts;

SELECT *
FROM TemperatureForecasts
WHERE countyName = '臺中市' AND regionName = '西屯區'
ORDER BY dataDate;
```

從 Python 讀取：

```python
import sqlite3
import pandas as pd

conn = sqlite3.connect("data.db")
df = pd.read_sql_query("SELECT * FROM TemperatureForecasts", conn)
```

---

## Vercel 部署

1. 將 GitHub repository 匯入 Vercel，使用 Python / FastAPI 專案設定。
2. 在 Vercel Project Settings → Environment Variables 設定 `CWA_API_KEY`，套用 Production 與 Preview。
3. 部署後打開 Vercel URL，確認 `/api/health` 顯示 22 縣市、368 鄉鎮，並操作地圖。

Production：<https://taiwan-weather-atlas.vercel.app>

Vercel 的 function filesystem 是暫存環境，`/tmp/weather.db` 僅作 instance-local cache，不能視為永久 Production Database。每個 cold start 會從 CWA 重新取得真實資料；需要持久化線上資料時，應改接託管資料庫。

## GitHub 與安全

- `.env`、SQLite 資料庫、Python cache、`.vercel` 與 `node_modules` 均不應提交。
- 只將 `CWA_API_KEY` 存在本機 `.env` 或 Vercel Environment Variables，不得放入原始碼、README 或 Git。
- 專案不使用 mock 或假天氣資料；整合測試需先取得 CWA 真實資料。
