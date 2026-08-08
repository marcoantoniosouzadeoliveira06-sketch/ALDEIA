@echo off
title ALDEIA - Servidor Local
cd /d "%~dp0"
set PORT=3102
echo Iniciando a ALDEIA em http://127.0.0.1:3102
echo Deixe esta janela aberta enquanto testa o site.
node server.js
pause
