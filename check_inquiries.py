import sqlite3

conn = sqlite3.connect('data.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT * FROM inquiries ORDER BY id DESC LIMIT 2').fetchall()
print('✅ Latest Contact Inquiries Stored:')
for r in rows:
    print(f"ID: {r['id']}, Name: {r['name']}, Email: {r['email']}, Subject: {r['subject']}, Message: {r['message'][:50]}")
conn.close()
