@echo off
echo ==============================================
echo  ALDEIA - Sincronizador com o GitHub
echo ==============================================
echo.

set "GIT_EXE=C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"

echo Salvando alteracoes...
"%GIT_EXE%" add .

echo Criando o commit...
"%GIT_EXE%" commit -m "Auto-commit: Atualizacoes do ALDEIA Site e CRM"

echo Fazendo o push para o GitHub...
"%GIT_EXE%" push origin main

echo.
echo ==============================================
echo  PUSH CONCLUIDO COM SUCESSO!
echo ==============================================
pause
