# REAME - Explicação dos Scripts de Gerenciamento de Pedidos

Este documento descreve a funcionalidade dos scripts e da arquitetura base criada para o sistema de gerenciamento de pedidos de um e-commerce.

## 1. `docker-compose.yml`

Este arquivo é a peça central para a configuração do nosso ambiente de desenvolvimento utilizando Docker. Ele define e orquestra os seguintes serviços:

* **`postgres`**: Configura uma instância do banco de dados PostgreSQL. As variáveis de ambiente (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`) são definidas para configurar o usuário, senha e nome do banco de dados. A porta `5432` é mapeada para o host, permitindo acesso externo. Um volume (`postgres_data`) é criado para persistir os dados do banco entre reinicializações dos contêineres.

* **`zookeeper`**: Inicializa um servidor Zookeeper, que é um requisito para o Kafka. Ele gerencia o cluster Kafka. A porta `2181` é exposta.

* **`kafka`**: Configura um broker Kafka. Ele depende do `zookeeper` para seu funcionamento. As portas `9092` (para comunicação interna) e `29092` (para acesso externo) são mapeadas. As variáveis de ambiente configuram a conexão com o Zookeeper e os listeners para comunicação.

* **`elasticsearch`**: Inicia um nó Elasticsearch em modo single-node. As variáveis de ambiente configuram o tipo de descoberta e as opções de JVM. As portas `9200` (para a API REST) e `9300` (para comunicação entre nós, embora aqui seja single-node) são expostas.

* **`nestjs-app`**: Define o contêiner para nossa aplicação Nest.js.
    * **`build: ./nestjs-app`**: Especifica o diretório contendo o Dockerfile para construir a imagem da aplicação.
    * **`ports: - "3000:3000"`**: Mapeia a porta `3000` do contêiner para a porta `3000` do host, tornando a API acessível.
    * **`environment`**: Define variáveis de ambiente que a aplicação Nest.js utilizará para se conectar ao PostgreSQL, Kafka e Elasticsearch.
    * **`depends_on`**: Garante que os serviços `postgres`, `kafka` e `elasticsearch` estejam em execução antes de tentar iniciar a aplicação Nest.js.
    * **`volumes`**: Monta o diretório `./nestjs-app` do host dentro do contêiner, permitindo o desenvolvimento com hot-reloading (dependendo da configuração do `start:dev` no `package.json`). O diretório `node_modules` é criado como um volume nomeado para evitar problemas de permissão.
    * **`networks`**: Associa este serviço à rede `app-network`, permitindo a comunicação com os outros serviços.

O arquivo `docker-compose.yml` permite iniciar toda a infraestrutura com um único comando: `docker-compose up`.

## 2. `.env`

Este arquivo armazena variáveis de ambiente sensíveis ou de configuração que são utilizadas pelo `docker-compose.yml` e pela aplicação Nest.js. No exemplo fornecido, ele define as credenciais e o nome do banco de dados PostgreSQL. Utilizar um arquivo `.env` é uma prática recomendada para evitar o hardcoding de informações confidenciais no código ou em arquivos de configuração.

## 3. `nestjs-app/Dockerfile`

Este arquivo contém as instruções para construir a imagem Docker da nossa aplicação Nest.js.

* **`FROM node:18-alpine`**: Define a imagem base como Node.js versão 18 rodando em Alpine Linux, uma distribuição Linux leve.
* **`WORKDIR /usr/src/app`**: Define o diretório de trabalho dentro do contêiner como `/usr/src/app`.
* **`COPY package*.json ./`**: Copia os arquivos `package.json` e `package-lock.json` (ou `yarn.lock`) para o diretório de trabalho.
* **`RUN npm install`**: Executa o comando `npm install` para instalar as dependências da aplicação. Esta etapa é feita antes de copiar o restante do código para aproveitar o cache de camadas do Docker.
* **`COPY . .`**: Copia todo o código fonte da aplicação para o diretório de trabalho.
* **`CMD ["npm", "run", "start:dev"]`**: Define o comando a ser executado quando o contêiner for iniciado. Neste caso, ele inicia o script `start:dev` definido no `package.json` do projeto Nest.js, geralmente utilizando `nodemon` para hot-reloading durante o desenvolvimento.

## 4. `nestjs-app/src/app.module.ts`

Este é o módulo raiz da aplicação Nest.js. Ele importa e configura outros módulos necessários para a funcionalidade principal:

* **`ConfigModule`**: Carrega as configurações da aplicação a partir de arquivos `.env` e outras fontes de configuração. `isGlobal: true` torna as configurações acessíveis em toda a aplicação.
* **`TypeOrmModule`**: Integra o TypeORM, um ORM (Object-Relational Mapper) para Node.js, facilitando a interação com o banco de dados PostgreSQL. A configuração da conexão com o banco de dados é feita utilizando as variáveis de ambiente carregadas pelo `ConfigModule`. `autoLoadEntities: true` carrega automaticamente as entidades definidas no projeto, e `synchronize: true` (apenas para desenvolvimento) sincroniza o esquema do banco de dados com as entidades.
* **`OrdersModule`**: Módulo responsável pela lógica de negócios relacionada aos pedidos (criação, leitura, atualização, exclusão e busca).
* **`KafkaModule`**: Módulo que encapsula a funcionalidade de comunicação com o servidor Kafka (publicação de eventos).
* **`ElasticsearchModule`**: Módulo que integra a aplicação com o Elasticsearch para indexação e busca de pedidos.
* **`LoggerModule`**: Módulo para logs estruturados na aplicação.

## 5. `nestjs-app/src/main.ts`

Este é o ponto de entrada principal da aplicação Nest.js.

* **`NestFactory.create(AppModule, { logger: new LoggerService() })`**: Cria uma instância da aplicação Nest.js, utilizando o `AppModule` como módulo raiz e configurando um logger customizado (`LoggerService`).
* **`app.useGlobalPipes(new ValidationPipe())`**: Aplica o `ValidationPipe` globalmente, que automaticamente valida os dados de entrada das requisições com base nas definições nos DTOs (Data Transfer Objects).
* **`DocumentBuilder` e `SwaggerModule`**: Configuram e habilitam a documentação da API utilizando o Swagger. O `DocumentBuilder` cria a estrutura da documentação, e o `SwaggerModule` a expõe em uma rota específica (`/api-docs`).
* **`app.listen(3000)`**: Inicia o servidor da aplicação na porta 3000.

## 6. `nestjs-app/src/config/configuration.ts`

Este arquivo define uma função que retorna um objeto contendo as configurações da aplicação, carregadas a partir das variáveis de ambiente. Isso facilita o acesso às configurações em toda a aplicação de forma tipada.

## 7. `nestjs-app/src/logger/logger.module.ts` e `nestjs-app/src/logger/logger.service.ts`

Estes arquivos implementam um módulo e um serviço de logging customizado. O `LoggerService` estende a classe `Logger` do Nest.js, permitindo a adição de formatação ou lógica extra aos logs (como prefixos). O `LoggerModule` torna o `LoggerService` injetável em outros módulos.

## 8. `nestjs-app/src/orders/orders.module.ts`

Este módulo agrupa todos os componentes relacionados à funcionalidade de pedidos:

* Importa o `OrdersController` (responsável por receber as requisições HTTP), o `OrdersService` (contém a lógica de negócios), o `TypeOrmModule` para gerenciar a entidade `Order`, e os módulos `KafkaModule` e `ElasticsearchModule` para comunicação externa.
* Declara o `OrdersController` e o `OrdersService` como parte deste módulo, tornando-os disponíveis para injeção de dependência.
* Importa o `OrdersRepository` para abstrair a interação com o banco de dados.

## 9. `nestjs-app/src/orders/orders.controller.ts`

Este controlador define os endpoints da API REST para gerenciar pedidos. Cada método do controlador corresponde a uma rota HTTP e invoca um método no `OrdersService` para executar a lógica de negócios:

* **`@Post()`**: Cria um novo pedido.
* **`@Get()`**: Lista todos os pedidos.
* **`@Get(':id')`**: Busca um pedido específico pelo ID.
* **`@Patch(':id')`**: Atualiza um pedido existente pelo ID.
* **`@Delete(':id')`**: Remove um pedido pelo ID.
* **`@Get('search')`**: Permite buscar pedidos com base em diferentes critérios (a lógica de busca detalhada estaria no `OrdersService` e utilizaria o Elasticsearch).

As decorators `@ApiTags` e `@ApiCreatedResponse`, `@ApiOkResponse` são utilizadas para configurar a documentação do Swagger.

## 10. `nestjs-app/src/orders/orders.service.ts`

Este serviço contém a lógica de negócios para as operações de gerenciamento de pedidos. Ele interage com o banco de dados através do `OrdersRepository`, publica eventos no Kafka através do `KafkaService` e indexa/busca dados no Elasticsearch através do `ElasticsearchService`:

* **`create(createOrderDto: CreateOrderDto)`**: Cria um novo pedido, salva no banco de dados, publica um evento `order_created` no Kafka e indexa o pedido no Elasticsearch.
* **`findAll()`**: Busca todos os pedidos do banco de dados.
* **`findOne(id: string)`**: Busca um pedido específico pelo ID no banco de dados. Lança uma `NotFoundException` se o pedido não for encontrado.
* **`update(id: string, updateOrderDto: UpdateOrderDto)`**: Atualiza um pedido existente, salva as alterações no banco de dados, publica um evento `order_status_updated` no Kafka e atualiza o documento correspondente no Elasticsearch.
* **`remove(id: string)`**: Remove um pedido do banco de dados e do Elasticsearch.
* **`search(query: any)`**: Implementa a lógica de busca de pedidos utilizando o Elasticsearch com base nos parâmetros da query. A estrutura da query para o Elasticsearch dependerá dos campos que precisam ser pesquisáveis (ID, status, intervalo de datas, itens). A parte incompleta do código sugere a construção de uma query booleana com diferentes tipos de consultas (term, range, nested) para atender aos requisitos de busca.

## Próximos Passos e Considerações

Esta é uma estrutura inicial. A implementação completa exigiria:

* Definição detalhada das entidades (`Order`, `OrderItem`) com seus respectivos campos e relacionamentos.
* Implementação completa dos DTOs (`CreateOrderDto`, `UpdateOrderDto`, `OrderItemDto`) para validação dos dados de entrada.
* Implementação dos serviços `KafkaService` e `ElasticsearchService` para interagir corretamente com Kafka e Elasticsearch. Isso incluiria a configuração dos clientes Kafka e Elasticsearch e a lógica para publicar/consumir mensagens e indexar/buscar documentos.
* Implementação completa da lógica de busca no método `search` do `OrdersService`, construindo as queries corretas para o Elasticsearch.
* Implementação de testes unitários e de integração para os controladores e serviços.
* Configuração de ESLint e Prettier para garantir a consistência do código.
* Implementação de logs estruturados e, idealmente, integração com ferramentas de monitoramento como Prometheus e Grafana e um sistema de logs centralizado como o ELK stack (Elasticsearch, Logstash, Kibana).

Este setup com Docker Compose facilita o desenvolvimento, pois permite ter todas as dependências (PostgreSQL, Kafka, Elasticsearch) rodando em contêineres isolados, simplificando a configuração do ambiente. A arquitetura proposta utiliza Nest.js para a API, TypeORM para o banco de dados, Kafka para comunicação assíncrona e Elasticsearch para busca, atendendo aos requisitos do desafio.
