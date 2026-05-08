@echo off
echo Starting REIMS Backend...
cd backend
pip install -r requirements.txt --quiet
start "REIMS Backend" python app.py
cd ..
echo.
echo Backend running at http://127.0.0.1:5000
echo Open frontend/index.html in your browser
echo.
pause
