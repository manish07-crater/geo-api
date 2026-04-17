import pandas as pd
import psycopg2
import os
from psycopg2.extras import execute_batch

# 🔗 DB connect
conn = psycopg2.connect(
    dbname="geo_db",
    user="postgres",
    password="ejsbdcwp",
    host="localhost",
    port="5432"
)
cursor = conn.cursor()

folder_path = "./data"

# 🇮🇳 Country check
cursor.execute("SELECT id FROM country WHERE name = %s", ("India",))
res = cursor.fetchone()

if res:
    country_id = res[0]
else:
    cursor.execute(
        "INSERT INTO country(name, code) VALUES (%s, %s) RETURNING id",
        ("India", "IN")
    )
    country_id = cursor.fetchone()[0]
    conn.commit()

print("✅ Country ready")

# 🔁 Loop all files
for file in os.listdir(folder_path):

    if file.endswith(".xls") or file.endswith(".ods"):
        print(f"📂 Processing: {file}")

        try:
            file_path = os.path.join(folder_path, file)

            df = pd.read_excel(file_path)

            # 🔥 CLEANING
            df.columns = df.columns.str.strip()
            df = df.fillna("").astype(str)

            required_cols = [
                "MDDS STC", "STATE NAME",
                "MDDS DTC", "DISTRICT NAME",
                "MDDS Sub_DT", "SUB-DISTRICT NAME",
                "MDDS PLCN", "Area Name"
            ]

            if not all(col in df.columns for col in required_cols):
                print(f"⚠️ Skipped (bad format): {file}")
                continue

            # 🔥 REMOVE INVALID ROWS
            df = df[
                (df["MDDS STC"] != "") &
                (df["MDDS DTC"] != "") &
                (df["MDDS Sub_DT"] != "")
            ]

            # 🔹 STATES
            state_data = df[["MDDS STC", "STATE NAME"]].drop_duplicates()

            execute_batch(cursor,
                """
                INSERT INTO state(code, name, country_id)
                VALUES (%s,%s,%s)
                ON CONFLICT (code) DO NOTHING
                """,
                [(row["MDDS STC"], row["STATE NAME"], country_id) for _, row in state_data.iterrows()]
            )
            conn.commit()

            # 🔹 DISTRICT
            district_data = df[["MDDS DTC", "DISTRICT NAME", "MDDS STC"]].drop_duplicates()

            execute_batch(cursor,
                """
                INSERT INTO district(code, name, state_id)
                SELECT %s, %s, id FROM state WHERE code = %s
                ON CONFLICT (code) DO NOTHING
                """,
                [(row["MDDS DTC"], row["DISTRICT NAME"], row["MDDS STC"]) for _, row in district_data.iterrows()]
            )
            conn.commit()

            # 🔹 SUB-DISTRICT
            sub_data = df[["MDDS Sub_DT", "SUB-DISTRICT NAME", "MDDS DTC"]].drop_duplicates()

            execute_batch(cursor,
                """
                INSERT INTO sub_district(code, name, district_id)
                SELECT %s, %s, id FROM district WHERE code = %s
                ON CONFLICT (code) DO NOTHING
                """,
                [(row["MDDS Sub_DT"], row["SUB-DISTRICT NAME"], row["MDDS DTC"]) for _, row in sub_data.iterrows()]
            )
            conn.commit()

            # 🔹 VILLAGES
            village_data = df[
                (df["MDDS PLCN"] != "") &
                (df["MDDS Sub_DT"] != "")
            ][["MDDS PLCN", "Area Name", "MDDS Sub_DT"]]

            execute_batch(cursor,
                """
                INSERT INTO village(code, name, sub_district_id)
                SELECT %s, %s, id FROM sub_district WHERE code = %s
                ON CONFLICT (code) DO NOTHING
                """,
                [(row["MDDS PLCN"], row["Area Name"], row["MDDS Sub_DT"]) for _, row in village_data.iterrows()],
                page_size=2000
            )
            conn.commit()

        except Exception as e:
            conn.rollback()  # 🔥 VERY IMPORTANT FIX
            print(f"❌ Error in file {file}: {e}")
            continue

print("🚀 ALL FILES IMPORTED SUCCESSFULLY")

cursor.close()
conn.close()