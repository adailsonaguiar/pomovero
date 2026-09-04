# Criando um instalador para macOS

Guia para empacotar e distribuir o **pomo_vero** (Wails v2) como aplicativo macOS, do build local ao instalador `.dmg`/`.pkg` assinado e notarizado.

## Pré-requisitos

- [Wails CLI](https://wails.io/docs/gettingstarted/installation) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- Go 1.25+ e Node.js instalados
- Xcode Command Line Tools (`xcode-select --install`)
- Para distribuição fora do seu Mac: conta no [Apple Developer Program](https://developer.apple.com/programs/) (US$ 99/ano)

Verifique o ambiente:

```sh
wails doctor
```

## 1. Build do aplicativo (.app)

Na raiz do projeto:

```sh
wails build -platform darwin/universal -clean
```

- `darwin/universal` gera um binário único para Intel e Apple Silicon. Use `darwin/arm64` ou `darwin/amd64` para builds específicos.
- O resultado fica em `build/bin/pomo_vero.app`.

> **Nota (CGO):** este projeto usa `go-sqlite3`, que depende de CGO. Para o build universal, o macOS SDK precisa estar disponível (vem com o Xcode CLT). Se o build universal falhar, gere para a arquitetura da sua máquina com `-platform darwin/arm64` (ou `amd64`).

Teste o app:

```sh
open build/bin/pomo_vero.app
```

> **Nota (banco de dados):** o app abre `./session_logs.db` relativo ao diretório de trabalho atual (`app.go`). Ao rodar via Finder, o diretório de trabalho é `/`, onde não há permissão de escrita. Para distribuição, recomenda-se mover o banco para `~/Library/Application Support/pomo_vero/` (ver seção 6).

## 2. Personalizando o app

- **Ícone:** substitua `build/appicon.png` (1024x1024 px) e rode `wails build` novamente.
- **Metadados:** edite `build/darwin/Info.plist` (nome de exibição, identificador do bundle, versão, copyright). Defina um `CFBundleIdentifier` único, ex. `br.com.adailson.pomovero`.
- **Nome/versão:** ajuste em `wails.json` e use `wails build -ldflags "-X main.version=1.0.0"` se quiser injetar versão no binário.

## 3. Criando um instalador .dmg (recomendado)

O formato mais comum de distribuição no macOS é um `.dmg` onde o usuário arrasta o app para `/Applications`.

### Opção A: create-dmg (visual, recomendado)

```sh
brew install create-dmg

create-dmg \
  --volname "Pomodoro" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --icon "pomo_vero.app" 150 190 \
  --app-drop-link 450 190 \
  "build/bin/pomo_vero-1.0.0.dmg" \
  "build/bin/pomo_vero.app"
```

### Opção B: hdiutil (nativo, sem dependências)

```sh
mkdir -p /tmp/dmg-staging
cp -R build/bin/pomo_vero.app /tmp/dmg-staging/
ln -s /Applications /tmp/dmg-staging/Applications

hdiutil create -volname "Pomodoro" \
  -srcfolder /tmp/dmg-staging \
  -ov -format UDZO \
  build/bin/pomo_vero-1.0.0.dmg

rm -rf /tmp/dmg-staging
```

## 4. Criando um instalador .pkg (alternativa)

Se preferir um instalador com wizard (Instalador do macOS):

```sh
productbuild \
  --component build/bin/pomo_vero.app /Applications \
  build/bin/pomo_vero-1.0.0.pkg
```

## 5. Assinatura e notarização (distribuição fora do seu Mac)

Sem assinatura + notarização, o Gatekeeper bloqueia o app em outros Macs ("aplicativo danificado" ou desenvolvedor não identificado).

### 5.1 Certificado

No portal Apple Developer, crie um certificado **Developer ID Application** (e **Developer ID Installer** se for distribuir `.pkg`) e instale-o no Keychain. Confirme:

```sh
security find-identity -v -p codesigning
```

### 5.2 Assinar o .app

```sh
codesign --force --deep --options runtime \
  --sign "Developer ID Application: SEU NOME (TEAMID)" \
  build/bin/pomo_vero.app

# Verificar
codesign --verify --deep --strict build/bin/pomo_vero.app
```

> `--options runtime` habilita o Hardened Runtime, obrigatório para notarização.

### 5.3 Notarizar

Crie uma senha de app em https://appleid.apple.com e guarde as credenciais:

```sh
xcrun notarytool store-credentials "pomo-vero-notary" \
  --apple-id "seu@email.com" \
  --team-id "TEAMID" \
  --password "senha-de-app"
```

Gere o `.dmg` (seção 3) **depois** de assinar o `.app`, assine o `.dmg` e envie para notarização:

```sh
codesign --sign "Developer ID Application: SEU NOME (TEAMID)" build/bin/pomo_vero-1.0.0.dmg

xcrun notarytool submit build/bin/pomo_vero-1.0.0.dmg \
  --keychain-profile "pomo-vero-notary" \
  --wait

# Anexa o carimbo de notarização ao dmg
xcrun stapler staple build/bin/pomo_vero-1.0.0.dmg
```

Pronto: o `.dmg` pode ser distribuído e abre sem avisos do Gatekeeper.

### Distribuição local (sem conta Apple)

Para uso pessoal ou testes, é possível pular assinatura/notarização. Quem baixar precisará liberar manualmente:

```sh
xattr -cr /Applications/pomo_vero.app
```

## 6. Checklist antes de distribuir

- [ ] `CFBundleIdentifier` único em `build/darwin/Info.plist`
- [ ] Versão atualizada (`CFBundleShortVersionString`)
- [ ] Ícone final em `build/appicon.png`
- [ ] Caminho do SQLite movido para um diretório gravável, ex.:

  ```go
  // app.go — em vez de "./session_logs.db"
  configDir, _ := os.UserConfigDir() // ~/Library/Application Support
  appDir := filepath.Join(configDir, "pomo_vero")
  os.MkdirAll(appDir, 0o755)
  dbPath := filepath.Join(appDir, "session_logs.db")
  ```

- [ ] Testado em um Mac "limpo" (ou outra conta de usuário) após instalar pelo `.dmg`

## 7. Automação (opcional)

Script único de release (`scripts/release-mac.sh`):

```sh
#!/bin/sh
set -e
VERSION=${1:?"uso: ./release-mac.sh 1.0.0"}
IDENTITY="Developer ID Application: SEU NOME (TEAMID)"

wails build -platform darwin/universal -clean
codesign --force --deep --options runtime --sign "$IDENTITY" build/bin/pomo_vero.app

create-dmg \
  --volname "Pomodoro" \
  --icon "pomo_vero.app" 150 190 \
  --app-drop-link 450 190 \
  "build/bin/pomo_vero-$VERSION.dmg" \
  "build/bin/pomo_vero.app"

codesign --sign "$IDENTITY" "build/bin/pomo_vero-$VERSION.dmg"
xcrun notarytool submit "build/bin/pomo_vero-$VERSION.dmg" --keychain-profile "pomo-vero-notary" --wait
xcrun stapler staple "build/bin/pomo_vero-$VERSION.dmg"
echo "Release pronto: build/bin/pomo_vero-$VERSION.dmg"
```

## Referências

- [Wails — Building](https://wails.io/docs/reference/cli#build)
- [Wails — Code Signing (macOS)](https://wails.io/docs/guides/signing)
- [Apple — Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
