# Auditoria UX — validar-detail
2026-08-14T11:37:24.274Z · 390x844 iPhone 13 · http://localhost:5173

## Barra
| Critério | Alvo | Resultado | Passa |
|---|---|---|---|
| Alvos de toque | >= 48px | 1 abaixo (menor 40px) | NAO |
| Corpo de texto | >= 18px | 5 abaixo (menor 12.8px) | NAO |
| Toques até avaria registada | <= 3 | 3 (gravou) | SIM |
| Erros de consola | 0 | 0 | SIM |

## Sequência de toques
1. abrir a app (ícone)
2. escrever a descrição
3. guardar

## Por ecrã

### 01-home — `shots/01-home.png`
alvos < 48px: **1** · texto < 18px: **5** · overflow: 0px

Alvos pequenos (top 12):
- 89.7x40 `button#btn-qc-mic.btn-secondary` "Ditar"

Texto pequeno (top 12):
- 15.2px `span` "Ditar"
- 16.8px `button.btn-secondary` "+ Adicionar Fotos, Áudio ou Materiais (Formulário Completo)"
- 16px `span` "#ca093d"
- 12.8px `span` "MÉDIA"
- 16px `span` "Estádio — local não indicado"

### 02-ocorrencias — `shots/02-ocorrencias.png`
alvos < 48px: **0** · texto < 18px: **0** · overflow: 0px