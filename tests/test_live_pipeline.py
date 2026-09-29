import sqlite3
import unittest

from weather_data import database_path, database_summary, read_forecasts


class LiveForecastPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.summary = database_summary()

    def test_database_contains_all_verified_coverage(self) -> None:
        self.assertEqual(self.summary["county_count"], 22)
        self.assertEqual(self.summary["township_count"], 368)
        self.assertGreaterEqual(self.summary["row_count"], 2576)

    def test_xitun_has_seven_real_forecast_days(self) -> None:
        rows = read_forecasts(county="臺中市", region="西屯區")
        self.assertEqual(len(rows), 7)
        self.assertEqual(len({row["dataDate"] for row in rows}), 7)
        self.assertTrue(all(row["sourceDataset"] == "F-D0047-075" for row in rows))

    def test_upsert_key_has_no_duplicate_rows(self) -> None:
        with sqlite3.connect(database_path()) as connection:
            duplicates = connection.execute(
                "SELECT COUNT(*) FROM ("
                "SELECT geocode, dataDate FROM TemperatureForecasts "
                "GROUP BY geocode, dataDate HAVING COUNT(*) > 1"
                ")"
            ).fetchone()[0]
        self.assertEqual(duplicates, 0)

if __name__ == "__main__":
    unittest.main()