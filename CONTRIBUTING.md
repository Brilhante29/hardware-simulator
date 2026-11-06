# Como contribuir

Execute por um servidor HTTP e rode `node tests/all.mjs` antes de enviar alterações em modelos. Não há instalação de dependências para o núcleo atual.

## Nova referência

Adicione um registro em `data/hardware-catalog.json` com ID único, fabricante, categoria e fonte oficial. Atualize a contagem visível se ela mudar. Um registro não cria um modelo nem deve receber selo de simulação funcional.

## Novo modelo

1. Registre a fonte oficial, revisão, página/tabela, condições e valores usados.
2. Declare entradas, saídas, pinos e o que fica fora do escopo. Diferencie típico, recomendado e máximo absoluto.
3. Implemente em `src/models/` ou `src/engine/`, sem DOM, relógio de parede ou rede.
4. Adicione testes de referência independentes: solução fechada, tabela verdade, limites e invariantes. Inclua casos em que o modelo não pode responder.
5. Conecte a interface somente depois de verificar o modelo. Mantenha sinais visuais ligados a estados calculados ou explicitamente injetados.

Os pontos de extensão ainda são módulos de código; não existe um marketplace ou carregador universal de plugins. Não copie datasheets para o repositório sem direitos de redistribuição. Arte procedural original pode seguir MIT; fontes e ativos de terceiros precisam da própria licença.

## Desempenho

Prefira trabalho proporcional aos eventos alterados, histórico limitado e atualização visual separada da simulação. Preserve pausa em segundo plano e movimento reduzido. Não introduza bundler, motor 3D, fontes remotas ou biblioteca grande para alterações simples.
