@echo off
cd backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -r requirements.txt
if not exist resqai.db python seed_database.py
uvicorn main:app --reload
