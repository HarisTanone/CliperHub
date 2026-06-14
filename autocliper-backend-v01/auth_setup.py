"""
Jalankan script ini SEKALI untuk login ke Google Drive via browser.
Token akan disimpan di token.pickle — setelah itu server bisa upload tanpa login lagi.

Usage:
    python auth_setup.py
"""
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ["https://www.googleapis.com/auth/drive"]
CLIENT_SECRET_FILE = "oauth_client.json"
TOKEN_FILE = "token.pickle"


def main():
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
    creds = flow.run_local_server(port=8080)

    with open(TOKEN_FILE, "wb") as f:
        pickle.dump(creds, f)

    print(f"\n✓ Token berhasil disimpan ke {TOKEN_FILE}")
    print(f"  Email: {creds.client_id}")
    print(f"  Server bisa upload ke Google Drive sekarang.")


if __name__ == "__main__":
    main()
