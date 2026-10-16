# TraceObra

TraceObra é uma base inicial de ERP web em JavaScript, com frontend em React e backend em Express, preparado para funcionar com PostgreSQL/Supabase.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Banco: PostgreSQL/Supabase
- Estilo: interface modular e responsiva com dashboard administrativo

## Estrutura

- `backend/` — API REST e schema do banco
- `frontend/` — painel web com módulos de gestão

## Começar

1. Instale as dependências:
   npm install --prefix backend
   npm install --prefix frontend
2. Configure o ambiente:
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   Defina `JWT_SECRET` no `backend/.env` com um segredo aleatório de pelo menos 32 caracteres antes de iniciar a API.
   Defina `INITIAL_ADMIN_PASSWORD` com uma senha forte e execute `npm run bootstrap:admin --prefix backend` uma vez para criar ou preparar o administrador inicial.
3. Rode os serviços:
   npm run dev

## Módulos base

- Dashboard
- Clientes
- Obras
- Tarefas e cronograma
- Estoque e materiais
- Fornecedores
- Financeiro
- Relatórios
- Usuários e permissões

## Banco de dados

O arquivo `backend/database/schema.sql` contém a estrutura inicial para PostgreSQL/Supabase. Em bancos existentes, configure `DATABASE_URL` em `backend/.env` e execute `npm run db:migrate --prefix backend`. O runner aplica cada arquivo numerado em `backend/database/migrations/` uma única vez e registra as versões em `schema_migrations`, sem reaplicar os dados de demonstração. A migration `005_subdivisions_and_projects.sql` separa o cadastro do loteamento das obras e vincula cada obra a um loteamento; dados de loteamentos antigos registrados junto de uma obra são migrados. A migration `006_project_material_usage.sql` adiciona o histórico de atividades/consumo de materiais, baixa o estoque dentro da transação da obra e permite quantidades fracionadas. As tabelas têm RLS habilitado sem políticas para negar acesso direto pelas roles `anon` e `authenticated`; o backend deve usar uma role de servidor/owner e continuar aplicando isolamento por empresa.

Se o certificado TLS do Supabase não for confiado pelo sistema, baixe o CA raiz em Database Settings > SSL Configuration e informe o caminho, relativo a `backend/`, em `DATABASE_SSL_CA`. A conexão verifica o certificado e não usa fallback inseguro.

Em produção, defina `CORS_ORIGINS` como uma lista separada por vírgulas com os domínios HTTPS do frontend. O fallback de localhost só é usado fora de produção.

## Mapas e concretagem

O cadastro de loteamentos tem uma tela própria em `/loteamentos`; o cadastro de obras fica em `/obras` e cada obra precisa pertencer a um loteamento. Ao cadastrar uma obra ou registrar uma alteração, informe a atividade e os materiais/quantidades utilizados. O consumo é gravado no histórico da obra e abatido do estoque na mesma transação; estoque insuficiente impede salvar a alteração. O mapa 2D usa Leaflet, tiles do OpenStreetMap e geometrias GeoJSON importadas na camada selecionada. A localização salva do loteamento posiciona o mapa e as camadas mostram a obra selecionada. O CEP é consultado pelo ViaCEP e o endereço é geocodificado pelo OpenStreetMap; confirme as coordenadas, pois o resultado pode ser aproximado, ou informe-as manualmente. A visualização dos tiles requer acesso à internet e mantém a atribuição do OpenStreetMap. O modo 3D atual é apenas uma prévia esquemática, não um visualizador IFC/BIM.

O módulo Concretagem registra peça, volume, classe, previsão, vínculo com obra/camada e fluxo de execução/FVS. Para validar o frontend, execute `npm test` e `npm run build` dentro de `frontend/`.

## Observação

Este projeto foi estruturado como base executável para evoluir com mais módulos, autenticação real e integrações com o Supabase.
fa