---
tag: "2026.09.23-current"
status: "CURRENT"
project: "AIoT L3 CWA HW1"
repo: "Lannjiarong/aiotl3_cwa_hw1"
description: "Current five-gate Taiwan Weather GIS development workflow"
source: "myplan/workflow.md"
---

# CURRENT TAG — 2026.09.23

> **Status: CURRENT / ACTIVE**
>
> This is the current project workflow baseline. Follow this version unless a newer tagged workflow explicitly supersedes it.

# Taiwan Weather GIS — Project Workflow

對齊課程海報《AI 創新微課程 Taiwan Weather Forecast》，以五個 Gate 完成：**CWA API → SQLite → 台灣地圖 GIS → GitHub → Vercel**。

## Governing Rule

嚴格依序執行：

```text
Gate 1 CWA API
 → Gate 2 Database
 → Gate 3 Local Taiwan GIS
 → Gate 4 GitHub
 → Gate 5 Vercel
```

**DO NOT BUILD EVERYTHING AT ONCE.**

每個 Gate 必須 `BUILD → RUN → TEST → VERIFY → PASS`。FAIL 時停留在該 Gate 修正。不得使用 mock / fake weather data。

### 課程 24 步對應

| Gate | 課程單元 | 重點 |
|------|----------|------|
| Gate 1 | 1–6 | CWA 平台、API、JSON、MinT / MaxT（本專案再加 T / Wx / PoP） |
| Gate 2 | 7–10 | Pandas 整理、SQLite、`TemperatureForecasts`、SQL 驗證 |
| Gate 3 | 11–19 | Streamlit 介面、折線圖、表格、Folium / 地圖、Dashboard |
| Gate 4 | 20–21 | 程式品質、`.env` 不進 Git、README、Push GitHub |
| Gate 5 | 22–24 | 部署公開網址、延伸應用 |

---

## Gate 1 — CWA API

### Locked Datasets

使用中央氣象署 Swagger 正式列出的 **22 個縣市未來 1 週鄉鎮預報資料集**。原先的 `F-D0047-093` endpoint 回傳縣市層級資料，無法提供鄉鎮地圖所需粒度，因此不再作為本專案資料來源。

官方資料集目錄：[台灣未來 1 週鄉鎮天氣預報](https://opendata.cwa.gov.tw/dataset/forecast/F-D0047-091)
官方 Swagger：[Opendata API](https://opendata.cwa.gov.tw/dist/opendata-swagger.html)
Swagger 規格：[OpenAPI YAML](https://opendata.cwa.gov.tw/apidoc/v1)

每個資料集使用以下官方 REST endpoint（不含 Key）：

```text
https://opendata.cwa.gov.tw/api/v1/rest/datastore/{DATASET_ID}
```

| Dataset ID | 縣市 | Dataset ID | 縣市 |
|------------|------|------------|------|
| `F-D0047-003` | 宜蘭縣 | `F-D0047-007` | 桃園市 |
| `F-D0047-011` | 新竹縣 | `F-D0047-015` | 苗栗縣 |
| `F-D0047-019` | 彰化縣 | `F-D0047-023` | 南投縣 |
| `F-D0047-027` | 雲林縣 | `F-D0047-031` | 嘉義縣 |
| `F-D0047-035` | 屏東縣 | `F-D0047-039` | 臺東縣 |
| `F-D0047-043` | 花蓮縣 | `F-D0047-047` | 澎湖縣 |
| `F-D0047-051` | 基隆市 | `F-D0047-055` | 新竹市 |
| `F-D0047-059` | 嘉義市 | `F-D0047-063` | 臺北市 |
| `F-D0047-067` | 高雄市 | `F-D0047-071` | 新北市 |
| `F-D0047-075` | 臺中市 | `F-D0047-079` | 臺南市 |
| `F-D0047-083` | 連江縣 | `F-D0047-087` | 金門縣 |

授權方式（二擇一，Key 一律從 `.env` 讀取）：

```text
Header:  Authorization: <CWA_API_KEY>
Query:   ?Authorization=<CWA_API_KEY>
```

建議最小驗證參數（縮小回傳、先確認 schema）：

```text
LocationName=西屯區
format=JSON
```

發布時機：每日約 05:30、11:30、17:30、23:30（每 6 小時更新）。

Target requirement:

```text
22 official F-D0047 weekly datasets
   ↓
All Taiwan townships and districts
   ↓
Next 7 days
   ↓
Temperature / MaxT / MinT / Wx / PoP
```

主要 Forecast factors：

- `平均溫度` → `Temperature` — 溫度
- `最高溫度` → `MaxTemperature` — 最高溫度
- `最低溫度` → `MinTemperature` — 最低溫度
- `天氣現象` → `Weather` — 天氣現象
- `12小時降雨機率` → `ProbabilityOfPrecipitation` — 降雨機率（12 小時分段）
- 其他欄位可保留供後續擴充，但 Gate 1 先聚焦上述欄位。

真實 JSON schema：`records.Locations[].Location[].WeatherElement[].Time[]`；各時段包含 `StartTime`、`EndTime`、`ElementValue`。`ElementValue` 內的實際欄位名稱依要素而異，必須按上述對照解析。

### Authentication / Secret Rule

CWA Authorization Key **不得寫入本文件、source code、README 或 GitHub**。

本機只使用：

```env
CWA_API_KEY=<YOUR_CWA_API_KEY>
```

由專案根目錄 `.env` 提供（已 gitignore）。可複製 `.env.example` 後再填入真實 Key。

> 此 Key 曾出現在聊天室，應視為 **exposed**。請到 [CWA Open Data](https://opendata.cwa.gov.tw/) 重新產生 / rotate，把新 Key 只放進本機 `.env`。不得把實際 Key commit 到 repository。

### Gate 1 Execution

Goal: 從 CWA Open Data API 的 22 個縣市一週資料集取得真實鄉鎮 Forecast JSON。

1. 僅使用上述 22 個 Swagger 官方一週 Dataset ID，不得混用縣市層級 dataset 或假資料。
2. 從 `.env` 讀取 `CWA_API_KEY`，log / output 不得顯示完整 Key。
3. 發送真實 CWA HTTP request（Header 或 Query 帶 Authorization）。
4. 驗證 HTTP status = success。
5. 保存 / 檢查實際 JSON response structure，再依真實 schema 實作 parser；禁止猜 schema。
6. 先選一個最小案例驗證，例如 `F-D0047-075` 的臺中市西屯區。
7. 驗證未來一週資料以及溫度、最高溫、最低溫、天氣現象、12 小時降雨機率。
8. 逐一確認 22 個縣市端點成功，並確認鄉鎮 / 行政區總覆蓋。
9. 建立可供 Gate 2 ETL 使用的乾淨輸出，但 Gate 1 **不得寫入 Database**。
10. 實際 RUN、TEST、VERIFY，留下不含 Secret 的驗證證據。

### Gate 1 PASS Criteria

只有以下全部成立才可回報 `GATE 1 = PASS`：

```text
[ ] Dataset = 22 official F-D0047 weekly endpoints
[ ] CWA authentication success
[ ] HTTP request success
[ ] Real JSON received
[ ] Actual JSON schema inspected
[ ] 7-day forecast confirmed
[ ] Temperature confirmed
[ ] MaxTemperature confirmed
[ ] MinTemperature confirmed
[ ] Weather confirmed
[ ] ProbabilityOfPrecipitation confirmed
[ ] 22 counties/cities and Taiwan township/district coverage confirmed
[ ] No mock/fake weather data
[ ] No API Key exposed in code/log/GitHub
```

禁止實作 SQLite、GIS、GitHub deployment 或 Vercel。Gate 1 FAIL 時留在 Gate 1 修正，不得進入 Gate 2。

### Gate 1 Verification — 2026-09-29

真實 API 驗證已完成：22 個官方一週端點全部 HTTP 200 / `success=true`，覆蓋 22 個縣市、368 個鄉鎮資料列，所有端點均含五項需求要素。臺中市西屯區抽驗為 15 個預報時段，實際時間涵蓋 2026-09-29 至 2026-10-07；已檢查真實 JSON schema。驗證輸出未包含 API Key，`.env` 維持 Git 忽略。

```text
GATE 1 = PASS
```

---

## Gate 2 — Database

前提：Gate 1 PASS。

將真實 CWA response 做 ETL 並存入 SQLite。建立 schema、資料驗證與 duplicate strategy，以 SQL SELECT 驗證指定地區及多地區資料。

建議資料表（可依真實 JSON 再調整，但不得改用假資料）：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | INTEGER PRIMARY KEY | 主鍵 |
| `countyName` | TEXT | 縣市名稱 |
| `regionName` | TEXT | 鄉鎮 / 行政區名稱 |
| `geocode` | TEXT | CWA 鄉鎮代碼 |
| `dataDate` | TEXT | 預報日期 |
| `t` | REAL | 當日平均溫度 |
| `mint` | REAL | 當日最低氣溫 |
| `maxt` | REAL | 當日最高氣溫 |
| `wx` | TEXT | 天氣現象 |
| `pop` | REAL | 12 小時降雨機率的當日最大值 |
| `latitude`, `longitude` | REAL | CWA 鄉鎮座標 |
| `sourceDataset` | TEXT | 官方 dataset ID |
| `updatedAt` | TEXT | 寫入時間 |

唯一鍵：`UNIQUE (geocode, dataDate)`，使用 SQLite `ON CONFLICT DO UPDATE`。

執行重點：

1. 建立 `data.db` 與資料表。
2. 重複執行時不重複插入（duplicate strategy）。
3. 用 SQL 驗證，例如依地區篩選、`SELECT DISTINCT regionName`。
4. 確認多縣市 / 多鄉鎮都有真實資料。

禁止開始 GIS。

完成才回報：`GATE 2 = PASS`。

### Gate 2 Verification — 2026-09-29

已用真實 CWA 資料執行兩次完整刷新。資料庫有 2,576 筆（368 鄉鎮 × 7 日）、22 個縣市；第二次刷新筆數不變，西屯區 SQL 查詢回傳 7 日，唯一鍵檢查沒有重複。三項 live database integration tests 全數通過。

```text
GATE 2 = PASS
```

---

## Gate 3 — Local Taiwan GIS

前提：Gate 2 PASS。

依序完成：

```text
3A Taiwan Map
3B One Marker
3C Weather Popup
3D Taiwan Locations
3E Database → GIS
3F Taiwan GeoJSON
3G Interactive Dashboard
```

GIS 使用 Leaflet + OpenStreetMap + Taiwan township GeoJSON。**Weather 必須由 Database API 提供**，不得直接打 API 假裝 GIS 完成。

完成才回報：`GATE 3 = PASS`。

### Gate 3 Verification — 2026-09-29

已完成台灣鄉鎮分區地圖、依日期與縣市著色、地區選取、七日溫度折線圖及預報表格。地圖 GeoJSON 有 377 個 feature，透過縣市／鄉鎮名稱與 SQLite 預報 join；桌面與 390px 手機瀏覽器檢查無水平溢位。Forecast / health API 均 HTTP 200，西屯區回傳七日資料。

```text
GATE 3 = PASS
```

---

## Gate 4 — GitHub

前提：Gate 3 PASS。

整理 repository、README / design、requirements 與安全設定。Push 前確認 `.env` 與任何 secret 不在 Git history / current files。

檢查清單：

```text
[ ] 程式結構清晰、錯誤處理、良好註解
[ ] requirements.txt 完整
[ ] README 說明如何 RUN / TEST
[ ] .gitignore 包含 .env、*.db cache、__pycache__
[ ] 遠端：https://github.com/Lannjiarong/aiotl3_cwa_hw1
[ ] Commit 不含 API Key
```

完成才回報：`GATE 4 = PASS`。

---

## Gate 5 — Vercel

前提：Gate 4 PASS。

連接 GitHub → Vercel，設定 Environment Variables，完成 build / deploy，驗證 public URL，並測試後續 GitHub push 能觸發 auto deployment。

Local SQLite 不視為 Vercel 的永久 Production Database；若需要線上持續寫入，另採 Cloud Database。

完成才回報：`GATE 5 = PASS`。

---

## Final

只有五 Gate 全 PASS 才回報：

```text
DIC-2 / AIoT L3 CWA HW1 = COMPLETE    (2026-09-23)
```

## Current Baseline

```text
TAG: 2026.09.23-current
STATUS: CURRENT
MAINLINE:
CWA API → Database → Local Taiwan GIS → GitHub → Vercel
```

目前進度：

```text
Gate 1 = PASS
Gate 2 = PASS
Gate 3 = PASS
Gate 4 = IN PROGRESS
Gate 5 = LOCKED
```
