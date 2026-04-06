@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════╗
echo ║   ArchTechTour - Portal de Operações         ║
echo ║   Instalação e Setup Automático              ║
echo ╚══════════════════════════════════════════════╝
echo.

:: Verificar se Node.js existe
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo.
    echo Siga estes passos:
    echo   1. Acesse: https://nodejs.org
    echo   2. Baixe a versão LTS (botão verde)
    echo   3. Instale com todas as opções padrão
    echo   4. Feche e reabra este terminal
    echo   5. Execute este script novamente
    echo.
    pause
    exit /b 1
)

:: Mostrar versão do Node
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js encontrado: %NODE_VER%

:: Instalar dependências
echo.
echo [1/3] Instalando dependências (pode levar 1-2 minutos)...
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependências. Verifique sua conexão.
    pause
    exit /b 1
)
echo [OK] Dependências instaladas!

:: Iniciar o servidor
echo.
echo [2/3] Compilando o projeto...
echo [3/3] Iniciando o servidor de desenvolvimento...
echo.
echo ══════════════════════════════════════════════
echo   Portal rodando em: http://localhost:3000
echo   Abra esse link no navegador!
echo.
echo   Para parar: Ctrl+C neste terminal
echo ══════════════════════════════════════════════
echo.

call npm run dev
