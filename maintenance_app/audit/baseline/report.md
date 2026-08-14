# Auditoria UX — baseline
2026-08-14T09:09:13.004Z · 390x844 iPhone 13 · http://localhost:5173

## Barra
| Critério | Alvo | Resultado | Passa |
|---|---|---|---|
| Alvos de toque | >= 48px | 42 abaixo (menor 13px) | NAO |
| Corpo de texto | >= 18px | 154 abaixo (menor 10.4px) | NAO |
| Toques até avaria registada | <= 3 | 6 (NAO GRAVOU) | NAO |
| Erros de consola | 0 | 0 | SIM |

## Sequência de toques
1. abrir a app (ícone)
2. botão + na barra inferior
3. toque no campo de localização
4. escrever a descrição
5. escrever o tempo gasto
6. guardar

**Notas do fluxo:**
- BLOQUEIO: dropdown de localização não abre nenhuma opção — impossível escolher local no formulário

## Por ecrã

### 01-home — `shots/01-home.png`
alvos < 48px: **4** · texto < 18px: **28** · overflow: 0px

Alvos pequenos (top 12):
- 358x45 `input#input-search-sectors.form-input` ""
- 127.1x30 `button.filter-chip` "Todos os Setores"
- 137.8x30 `button.filter-chip` "⚠️ Com Avarias (0)"
- 108.9x30 `button.filter-chip` "🔴 Críticas (0)"

Texto pequeno (top 12):
- 15.2px `h1.greeting` "Olá,"
- 15.2px `span.user-name` "Técnico"
- 10.4px `p.subtitle` "Estádio Municipal de Leiria"
- 11.5px `span.status-text` "Online"
- 11.5px `span.stat-label` "Ativas:"
- 11.5px `span.stat-label` "Críticas:"
- 11.5px `span.stat-label` "Em Curso:"
- 12.8px `p.section-subtitle` "Navegue pelas bancadas, salas técnicas e equipamentos"
- 12.2px `button.filter-chip` "Todos os Setores"
- 12.2px `button.filter-chip` "⚠️ Com Avarias (0)"
- 12.2px `button.filter-chip` "🔴 Críticas (0)"
- 15.4px `h3.sector-name` "Bancada Poente (Principal & VIP)"

### 02-ocorrencias — `shots/02-ocorrencias.png`
alvos < 48px: **6** · texto < 18px: **17** · overflow: 0px

Alvos pequenos (top 12):
- 358x45 `input#input-search-reports.form-input` ""
- 61.6x30 `button.filter-chip` "Todos"
- 90.7x30 `button.filter-chip` "🔴 Críticas"
- 107.6x30 `button.filter-chip` "⏳ Pendentes"
- 103.5x30 `button.filter-chip` "⚙️ Em Curso"
- 111x30 `button.filter-chip` "✅ Resolvidos"

Texto pequeno (top 12):
- 15.2px `h1.greeting` "Olá,"
- 15.2px `span.user-name` "Técnico"
- 10.4px `p.subtitle` "Estádio Municipal de Leiria"
- 11.5px `span.status-text` "Online"
- 12.8px `p.section-subtitle` "Registo e Acompanhamento de Trabalhos"
- 12px `span.section-badge` "0 filtradas"
- 12.2px `button.filter-chip` "Todos"
- 12.2px `button.filter-chip` "🔴 Críticas"
- 12.2px `button.filter-chip` "⏳ Pendentes"
- 12.2px `button.filter-chip` "⚙️ Em Curso"
- 12.2px `button.filter-chip` "✅ Resolvidos"
- 16px `h3.empty-title` "Sem registos de manutenção"

### 03-metricas — `shots/03-metricas.png`
alvos < 48px: **0** · texto < 18px: **25** · overflow: 0px

Texto pequeno (top 12):
- 15.2px `h1.greeting` "Olá,"
- 15.2px `span.user-name` "Técnico"
- 10.4px `p.subtitle` "Estádio Municipal de Leiria"
- 11.5px `span.status-text` "Online"
- 12.8px `p.section-subtitle` "Produtividade & Estado Operacional do Estádio"
- 12px `span.section-badge` "0 Registos"
- 11.5px `span.kpi-label` "Taxa Resolução"
- 11.5px `span.kpi-subtext` "0/0"
- 11.5px `span.kpi-label` "Críticas Ativas"
- 11.5px `span.kpi-subtext` "Tudo calmo"
- 11.5px `span.kpi-label` "Tempo Investido"
- 11.5px `span.kpi-subtext` "0 min totais"

### 04-definicoes — `shots/04-definicoes.png`
alvos < 48px: **9** · texto < 18px: **30** · overflow: 0px

Alvos pequenos (top 12):
- 117.1x26 `button#btn-add-room-settings.btn-primary-cta` "+ Nova Divisão"
- 328x46 `input#settings-room-search.form-input` ""
- 278.7x46 `input#input-new-material.form-input` ""
- 41.3x46 `button#btn-add-material.btn-primary-cta` "+"
- 8.4x16 `button.btn-del-mat` "×"
- 8.4x16 `button.btn-del-mat` "×"
- 8.4x16 `button.btn-del-mat` "×"
- 8.4x16 `button.btn-del-mat` "×"
- 8.4x16 `button.btn-del-mat` "×"

Texto pequeno (top 12):
- 15.2px `h1.greeting` "Olá,"
- 15.2px `span.user-name` "Técnico"
- 10.4px `p.subtitle` "Estádio Municipal de Leiria"
- 11.5px `span.status-text` "Online"
- 12.8px `p.section-subtitle` "Gestão de Setores, Salas Técnicas e Materiais"
- 15.2px `h3.analytics-card-title` "Divisões do Estádio (33)"
- 11.5px `span` "Base de dados de 1000+ chaves"
- 12.5px `button.btn-primary-cta` "+ Nova Divisão"
- 15.2px `strong` "Bancada Poente (Principal & VIP)"
- 12px `span` "6 div"
- 15.2px `strong` "Bancada Nascente"
- 12px `span` "4 div"

### 05-nova-ocorrencia — `shots/05-nova-ocorrencia.png`
alvos < 48px: **23** · texto < 18px: **54** · overflow: 0px

Alvos pequenos (top 12):
- 358x45 `input#input-search-sectors.form-input` ""
- 127.1x30 `button.filter-chip` "Todos os Setores"
- 137.8x30 `button.filter-chip` "⚠️ Com Avarias (0)"
- 108.9x30 `button.filter-chip` "🔴 Críticas (0)"
- 16.8x28.8 `button#btn-cancel-report.btn-close-detail` "×"
- 271.5x46 `input#search-location-input.searchable-select-input` ""
- 70.5x46 `button#btn-new-location-inline.btn-secondary` "+ Local"
- 111.3x42 `button.btn-secondary` "🟢 Baixa"
- 111.3x42 `button.btn-secondary` "🟡 Média"
- 111.3x42 `button.btn-secondary` "🔴 Crítica"
- 350x19.2 `label.form-label` "Descrição do Trabalho / Avaria *"
- 40x40 `button#btn-toggle-mic.btn-mic-record` "Gravar Nota de Voz"

Texto pequeno (top 12):
- 15.2px `h1.greeting` "Olá,"
- 15.2px `span.user-name` "Técnico"
- 10.4px `p.subtitle` "Estádio Municipal de Leiria"
- 11.5px `span.status-text` "Online"
- 11.5px `span.stat-label` "Ativas:"
- 11.5px `span.stat-label` "Críticas:"
- 11.5px `span.stat-label` "Em Curso:"
- 12.8px `p.section-subtitle` "Navegue pelas bancadas, salas técnicas e equipamentos"
- 12.2px `button.filter-chip` "Todos os Setores"
- 12.2px `button.filter-chip` "⚠️ Com Avarias (0)"
- 12.2px `button.filter-chip` "🔴 Críticas (0)"
- 15.4px `h3.sector-name` "Bancada Poente (Principal & VIP)"