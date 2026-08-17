# FICHA 10 — Ligar a compressão de fotos

**Tempo:** 1 hora
**Risco:** Baixo
**Ficheiro:** `maintenance_app/src/main.js`

## O problema

A câmara de um telemóvel moderno dá ficheiros de 3 a 8 MB. O código guarda o
ficheiro **original**, sem tocar. Dez avarias com foto enchem a base local com
80 MB, e cada sincronização tenta subir isso em base64 (33% maior ainda).

O `PROJECT.md` promete compressão para 1280px e ~180 KB. **Essa compressão nunca
foi escrita.**

## O que já está feito

O serviço de compressão **já existe e já está testado**:

- `maintenance_app/src/services/photoCompressor.js` — o serviço
- `maintenance_app/tests/unit/photoCompressor.test.js` — 6 testes que passam

**Não mexas nestes dois ficheiros.** Esta ficha só liga o serviço ao formulário.

## Alteração 1 de 2 — importar o serviço

**Procura este texto exato** (linha 21, no topo do ficheiro):

### ANTES
```javascript
import { photoEditor } from './services/photoEditor.js';
```

### DEPOIS
```javascript
import { photoEditor } from './services/photoEditor.js';
import { compressPhoto } from './services/photoCompressor.js';
```

## Alteração 2 de 2 — comprimir antes de guardar

**Procura este texto exato** (está por volta da linha 814):

### ANTES
```javascript
  async handlePhotoAdded(file, type) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const photoItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + type,
        blobData: file,
        dataUrl,
        type,
        mimeType: file.type || 'image/jpeg'
      };

      this.tempPhotos.push(photoItem);
      this.renderPhotoPreviews();

      // Offer immediate markup annotation
      toast.success('Foto carregada! Toque na foto para desenhar setas ou anotações.');
    };
    reader.readAsDataURL(file);
  }
```

### DEPOIS
```javascript
  /**
   * Recebe uma foto do input de câmara, comprime-a e guarda-a na lista temporária.
   *
   * A compressão acontece AQUI e não ao gravar: uma foto de 8 MB da câmara nunca
   * chega a entrar na memória da app em tamanho original mais do que o instante
   * necessário. Se a compressão falhar, o photoCompressor devolve o ficheiro
   * original — perder qualidade é aceitável, perder a foto do técnico não é.
   */
  async handlePhotoAdded(file, type) {
    try {
      const result = await compressPhoto(file);

      const photoItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + type,
        blobData: result.blob,
        dataUrl: result.dataUrl,
        type,
        mimeType: result.mimeType
      };

      this.tempPhotos.push(photoItem);
      this.renderPhotoPreviews();

      toast.success('Foto guardada. Toque na foto para desenhar setas ou anotações.');
    } catch (err) {
      console.error('[handlePhotoAdded] Erro ao processar a foto:', err);
      toast.error('Não foi possível processar a foto.');
    }
  }
```

## Verificar

```
cd C:\dev\estadio\maintenance_app
npm test
```

Tem de dar **`126 passed`** (os 120 de sempre + os 6 do compressor).

Se der `120 passed`, os testes do compressor não estão a correr — escreve
`BLOQUEADO: testes do photoCompressor não encontrados`.

## Verificação extra (importante, se souberes arrancar a app)

```
npm run dev
```

1. Abre `http://localhost:5173`
2. Vai a **Hoje** → "+ Adicionar Fotos ou Materiais (Formulário Completo)"
3. Escolhe uma foto grande (2 MB ou mais) no campo "Foto Antes"
4. A pré-visualização tem de aparecer em menos de 3 segundos
5. Abre a consola do navegador (F12) e confirma que **não há erros vermelhos**

Se a pré-visualização não aparecer, escreve
`BLOQUEADO: pré-visualização da foto não aparece` e desfaz com `git checkout .`.

## Commit

```
git add -A
git commit -m "perf: comprimir fotos para 1600px JPEG antes de guardar"
```

## Resposta

```
FICHA: 10
ESTADO: FEITO
TESTES: 126 passed
COMMIT: perf: comprimir fotos para 1600px JPEG antes de guardar
```
