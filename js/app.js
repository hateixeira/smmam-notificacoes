<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plataforma de Fiscalização - SMMAM</title>
    <link rel="stylesheet" href="css/style.css?v=6">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

    <div id="loading-overlay">
        <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
        <div id="loading-msg">Sincronizando Banco de Dados...</div>
    </div>
    <div id="toast">Operação realizada com sucesso!</div>

    <!-- TELAS DE ACESSO -->
    <div id="auth-container">
        <h2 id="authTitle">Acesso - Fiscalização</h2>
        <div id="login-fields">
            <input type="email" id="authEmail" placeholder="E-mail da Prefeitura">
            <input type="password" id="authPassword" placeholder="Senha">
            <button class="btn-primary" onclick="realizarLogin()" style="width: 100%;">Entrar no Sistema</button>
        </div>
        <div id="register-fields" style="display:none;">
            <div style="font-size: 11px; background: #e2e8f0; color: #1e293b; padding: 8px; border-radius: 4px; margin-bottom: 10px;">
                ⚠️ <strong>Atenção:</strong> Apenas e-mails com domínio <strong>@bentogoncalves.rs.gov.br</strong> são permitidos, salvo exceções autorizadas pelo Administrador.
            </div>
            <input type="text" id="regNome" placeholder="Nome Completo">
            <input type="text" id="regCargo" placeholder="Cargo (Ex: Fiscal, Agente Administrativo)">
            <select id="regSetor" style="margin-bottom: 12px; padding: 12px; font-weight: bold; color: #1b365d;">
                <option value="" disabled selected>Selecione sua Secretaria/Setor...</option>
                <option value="SMMAM">SMMAM (Meio Ambiente)</option>
                <option value="MOBILIDADE">Mobilidade Urbana (Trânsito)</option>
                <option value="OBRAS">Obras e Posturas</option>
            </select>
            <input type="text" id="regCpf" placeholder="CPF" maxlength="14">
            <input type="text" id="regTelefone" placeholder="Telefone Celular" maxlength="15">
            <input type="text" id="regMatricula" placeholder="Nº da Matrícula / RE">
            <input type="email" id="regEmail" placeholder="E-mail Institucional">
            <input type="password" id="regPassword" placeholder="Crie uma Senha (mín. 6 caracteres)">
            <button class="btn-success" onclick="registrarUsuario()" style="width: 100%;">Finalizar Cadastro</button>
        </div>
        <div class="auth-links">
            <span id="btnToggleAuth" onclick="toggleAuthMode()">Servidor Novo? Solicite Acesso</span>
            <span onclick="recuperarSenha()">Esqueci a Senha</span>
        </div>
    </div>

    <div id="waiting-room" style="display:none;">
        <h2>⏳ Acesso em Análise</h2>
        <p>O seu cadastro foi realizado com sucesso!<br>Para garantir a segurança dos dados, o seu perfil está aguardando a liberação da Chefia da sua Secretaria.</p>
        <button class="btn-secondary" onclick="realizarLogout()" style="width: 200px; margin: 0 auto;">Sair</button>
    </div>

    <!-- ESTRUTURA SPA -->
    <div id="app-layout" style="display: none;">
        
        <aside id="sidebar">
            <div class="sidebar-header">
                <h3>Fiscalização</h3>
                <span id="sidebar-setor">Carregando...</span>
            </div>
            <nav class="sidebar-nav">
                <a class="nav-item active" onclick="navegarPara('inicio')" id="nav-inicio">🏠 Tela Inicial</a>
                <a class="nav-item" onclick="navegarPara('notificacoes')" id="nav-notificacoes">📝 Nova Notificação</a>
                <a class="nav-item" onclick="navegarPara('autos')" id="nav-autos">🚨 Novo Auto (Multa)</a>
                <a class="nav-item" onclick="navegarPara('consulta')" id="nav-consulta">🔍 Consulta Cadastral</a>
                <a class="nav-item" onclick="navegarPara('relatorios')" id="nav-relatorios">📈 Relatórios e Gráficos</a>
                <a class="nav-item" onclick="navegarPara('perfil')" id="nav-perfil">👤 Meu Perfil</a>
                
                <div id="menu-admin-area" style="display: none;">
                    <div class="nav-section-title">ADMINISTRAÇÃO</div>
                    <a class="nav-item" onclick="navegarPara('auditoria')" id="nav-auditoria">🛡️ Auditoria do Sistema</a>
                    <a class="nav-item" onclick="navegarPara('configuracoes')" id="nav-configuracoes">⚙️ Configurações</a>
                </div>
            </nav>
            <div class="sidebar-footer">
                <span id="userLoggedDisplay" style="display:block; margin-bottom: 10px; font-size: 11px;"></span>
                <button class="btn-logout" onclick="realizarLogout()" style="width: 100%;">Sair do Sistema</button>
            </div>
        </aside>

        <main id="main-content">
            
            <!-- VIEW 1: TELA INICIAL -->
            <div id="view-inicio" class="view-section active-view">
                <h2>Visão Geral do Setor</h2>
                <div class="dashboard-cards">
                    <div class="card card-total"><div class="num" id="dashTotalNotif">0</div><div class="label">Notificações</div></div>
                    <div class="card card-total"><div class="num" id="dashTotalAutos">0</div><div class="label">Autos / Multas</div></div>
                    <div class="card card-info"><div class="num" id="dashAREnviados">0</div><div class="label">ARs Enviados</div></div>
                    <div class="card card-prazo"><div class="num" id="dashARRetornados">0</div><div class="label">ARs Recebidos</div></div>
                    <div class="card card-vencida"><div class="num" id="dashVencidas">0</div><div class="label">Prazos Vencidos</div></div>
                </div>

                <div class="panel-container" style="margin-top: 20px;">
                    <div class="toolbar">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                            <div class="filter-group">
                                <button class="filter-type-btn active" onclick="aplicarFiltroTipo('Todos', this)">📋 Mostrar Todos</button>
                                <button class="filter-type-btn" onclick="aplicarFiltroTipo('notificacao', this)">📝 Só Notificações</button>
                                <button class="filter-type-btn" onclick="aplicarFiltroTipo('auto', this)">🚨 Só Autos</button>
                            </div>
                        </div>
                        <input type="text" id="buscaInput" class="search-box" placeholder="🔍 Buscar por rua, número, nome, lote, código AR..." onkeyup="renderizarPainel()">
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                            <div class="filter-bar">
                                <span style="font-size: 11px; font-weight: bold; color: #64748b; margin-top: 5px;">FILTROS:</span>
                                <button class="filter-btn active" onclick="aplicarFiltro('Todos', this)">Todos</button>
                                <button class="filter-btn" onclick="aplicarFiltro('No Prazo', this)">⏳ No Prazo</button>
                                <button class="filter-btn" onclick="aplicarFiltro('Vencidos', this)">⚠️ Vencidos</button>
                                <button class="filter-btn" onclick="aplicarFiltro('Com AR', this)">📬 Com AR</button>
                            </div>
                            <div>
                                <button class="btn-primary btn-outline" onclick="exportarVipp()" style="padding: 6px 12px; font-size: 12px;">📦 Exportar VIPP</button>
                                <button class="btn-success" onclick="exportarExcel()" style="padding: 6px 12px; font-size: 12px;" title="Baixar Excel">📊 Excel</button>
                            </div>
                        </div>
                        <div class="btn-actions" id="areaBotoesAdminExcluir" style="display:none; margin-top:5px;">
                            <button id="btnExcluirLote" class="btn-danger" onclick="excluirSelecionadas()">🗑️ Excluir Selecionadas</button>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 30px;"><input type="checkbox" id="selecionarTodos" onclick="toggleTodos(this)"></th>
                                    <th>Tipo</th>
                                    <th class="sortable" onclick="ordenarTabela('numNotif')">Nº Reg. <span class="sort-icon">▼▲</span></th>
                                    <th class="sortable" onclick="ordenarTabela('nome')">Nome / Alvo <span class="sort-icon">▼▲</span></th>
                                    <th>Status (AR/Prazo)</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaCorpo"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- VIEW 2: FORMULÁRIO DE NOTIFICAÇÕES -->
            <div id="view-notificacoes" class="view-section">
                <div class="form-container">
                    <h2 id="mainHeaderTitleForm">Gerar Nova Notificação</h2>
                    <form id="notifForm" onsubmit="salvarDocumento(event, 'notificacao')">
                        <input type="hidden" id="editFirebaseIdNotif">
                        <div class="form-row">
                            <div class="form-group" style="flex: 1.2;"><label>Nº Notificação *</label><input type="text" id="numNotif" required></div>
                            <div class="form-group" style="flex: 1.2;"><label>Proc. / Ouvidoria</label><input type="text" id="procOuvidoria"></div>
                            <div class="form-group" style="flex: 1.5;"><label>Data *</label><input type="date" id="dataNotif" required></div>
                        </div>
                        <div class="form-group">
                            <label>Forma de Notificação *</label>
                            <div class="checkbox-group">
                                <div class="checkbox-item"><input type="radio" id="tipoPresencial" name="tipoNotif" value="Presencial" checked><label for="tipoPresencial">Presencial</label></div>
                                <div class="checkbox-item"><input type="radio" id="tipoAR" name="tipoNotif" value="AR"><label for="tipoAR">Por AR</label></div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group" style="flex: 2;"><label>Nome do Notificado *</label><input type="text" id="nome" required></div>
                            <div class="form-group" style="flex: 1.2;"><label>CPF/CNPJ *</label><input type="text" id="doc" maxlength="18" required></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>CEP</label><input type="text" id="cep" maxlength="9"></div>
                            <div class="form-group" style="flex: 2;"><label>Endereço de Correspondência</label><input type="text" id="endereco"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>Bairro</label><input type="text" id="bairro"></div>
                            <div class="form-group"><label>Telefone</label><input type="text" id="telefone" maxlength="15"></div>
                        </div>

                        <div style="font-weight: bold; margin: 10px 0 5px 0; color: #1b365d; font-size:13px;">Cadastro Imobiliário (Busca Automática)</div>
                        <div class="form-row">
                            <div class="form-group"><label>Distr.</label><input type="text" id="cadDistrito" placeholder="01"></div>
                            <div class="form-group"><label>Zona</label><input type="text" id="cadZona" placeholder="5"></div>
                            <div class="form-group"><label>Quadr.</label><input type="text" id="cadQuadra" placeholder="071"></div>
                            <div class="form-group"><label>Lote</label><input type="text" id="cadLote" placeholder="0015"></div>
                            <div class="form-group" style="flex: 1.5;"><label>Cad. Imob.</label><input type="text" id="cadImob"></div>
                        </div>
                        <div class="form-group"><label>Endereço do Local da Ocorrência *</label><input type="text" id="loteEndereco" required></div>

                        <div class="form-group">
                            <label>Irregularidades Verificadas</label>
                            <div class="checkbox-group">
                                <div class="checkbox-item"><input type="checkbox" id="irrMato"><label for="irrMato">Vegetação/Mato</label></div>
                                <div class="checkbox-item"><input type="checkbox" id="irrResiduos"><label for="irrResiduos">Resíduos Sólidos</label></div>
                                <div class="checkbox-item"><input type="checkbox" id="irrEntulhos"><label for="irrEntulhos">Obra Irregular / Posturas</label></div>
                                <div class="checkbox-item"><input type="checkbox" id="irrOutros"><label for="irrOutros">Outros</label></div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>Ponto de Referência</label><input type="text" id="ref"></div>
                            <div class="form-group"><label>Observações</label><input type="text" id="obs"></div>
                        </div>
                        <div class="form-group">
                            <label>Base Legal</label>
                            <div class="checkbox-group">
                                <div class="checkbox-item"><input type="checkbox" id="lei5198" checked><label for="lei5198">Art. 6º, § 2º - L 5.198</label></div>
                                <div class="checkbox-item"><input type="checkbox" id="lc56"><label for="lc56">Art. 41, inc. III - LC 56</label></div>
                            </div>
                        </div>

                        <div style="font-weight: bold; margin: 15px 0 5px 0; color: #1b365d; font-size:13px; border-top: 1px solid #eee; padding-top: 10px;">Acompanhamento / Prazos</div>
                        <div class="form-row">
                            <div class="form-group" style="flex: 1.5;"><label>Código AR (Correios)</label><input type="text" id="codigoAR" placeholder="BR123456789BR" maxlength="13"></div>
                            <div class="form-group" style="flex: 1.5;">
                                <label>Retorno Físico do AR?</label>
                                <select id="statusRetornoAR">
                                    <option value="aguardando">⏳ Aguardando Retorno</option>
                                    <option value="transito">🚚 Em Trânsito</option>
                                    <option value="saiu_entrega">🛵 Saiu para Entrega</option>
                                    <option value="tentativa">⚠️ Tentativa de Entrega</option>
                                    <option value="retirada">🏢 Aguardando Retirada</option>
                                    <option value="entregue">✅ Entregue / Assinado</option>
                                    <option value="devolvido">❌ Devolvido / Não Localizado</option>
                                </select>
                            </div>
                            <div class="form-group"><label>Prazo p/ Regularizar</label><input type="date" id="dataPrazo"></div>
                        </div>

                        <div class="form-group">
                            <label>Evidências Fotográficas <span id="indicadorFotosNotif" class="foto-loading" style="display:none;">Carregando...</span></label>
                            <input type="file" id="inputFotosNotif" accept="image/*" multiple onchange="processarFotos(event, 'previewFotosNotif')" style="background: #fff; padding: 5px;">
                            <div id="previewFotosNotif" style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;"></div>
                        </div>

                        <div class="btn-actions" id="areaBotoesSalvarNotif">
                            <button type="submit" id="btnSalvarNotif" class="btn-success" style="flex: 2;">☁️ Salvar Notificação</button>
                            <button type="button" class="btn-secondary" onclick="limparFormularios()">🔄 Limpar</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- VIEW 3: AUTO DE INFRAÇÃO -->
            <div id="view-autos" class="view-section">
                <div class="form-container">
                    <h2 style="color: #991b1b; border-color: #fecaca;">Gerar Auto de Infração (Multa)</h2>
                    
                    <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px dashed #cbd5e1; margin-bottom: 20px;">
                        <label>Vincular a uma Notificação Anterior</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="autoBuscaNotif" placeholder="Digite o Nº da Notificação Ex: 0520B">
                            <button type="button" class="btn-primary" onclick="puxarDadosDaNotificacao()">🔍 Puxar Dados</button>
                        </div>
                    </div>

                    <form id="autoForm" onsubmit="salvarDocumento(event, 'auto')">
                        <input type="hidden" id="editFirebaseIdAuto">
                        
                        <div class="form-row">
                            <div class="form-group"><label>Nº do Auto *</label><input type="text" id="autoNum" required></div>
                            <div class="form-group"><label>Data da Autuação *</label><input type="date" id="autoData" required></div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group" style="flex: 2;"><label>Nome do Infrator *</label><input type="text" id="autoNome" required></div>
                            <div class="form-group" style="flex: 1.2;"><label>CPF/CNPJ *</label><input type="text" id="autoDoc" required></div>
                        </div>
                        
                        <div class="form-group"><label>Endereço da Ocorrência *</label><input type="text" id="autoEndOcorrencia" required></div>
                        <div class="form-group"><label>Enquadramento Legal (Descritivo)</label><input type="text" id="autoDescricaoLei" placeholder="Ex: Artigo 6º, da Lei Municipal 5.198"></div>

                        <div style="font-weight: bold; margin: 15px 0 5px 0; color: #991b1b; font-size:13px; border-top: 1px solid #eee; padding-top: 10px;">Cálculo da Multa Baseado na URM</div>
                        
                        <div class="form-row" style="align-items: center;">
                            <div class="form-group">
                                <label>Quantidade de URM Aplicada</label>
                                <input type="number" id="autoMultaURM" step="0.01" value="100" oninput="calcularMultaReais()">
                            </div>
                            <div style="font-size: 20px; font-weight: bold; color: #475569; margin: 0 10px;">X</div>
                            <div class="form-group">
                                <label>Valor URM do Ano (R$)</label>
                                <input type="text" id="autoValorURMAtual" disabled style="background:#f1f5f9; font-weight:bold;">
                            </div>
                            <div style="font-size: 20px; font-weight: bold; color: #475569; margin: 0 10px;">=</div>
                            <div class="form-group" style="flex: 1.5;">
                                <label style="color: #991b1b;">Total da Multa (R$)</label>
                                <input type="text" id="autoMultaReais" disabled style="background:#fee2e2; color:#991b1b; font-size: 16px; font-weight:bold;">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Evidências Fotográficas <span id="indicadorFotosAuto" class="foto-loading" style="display:none;">Carregando...</span></label>
                            <input type="file" id="inputFotosAuto" accept="image/*" multiple onchange="processarFotos(event, 'previewFotosAuto')" style="background: #fff; padding: 5px;">
                            <div id="previewFotosAuto" style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;"></div>
                        </div>

                        <div class="btn-actions" id="areaBotoesSalvarAuto">
                            <button type="submit" id="btnSalvarAuto" class="btn-danger" style="flex: 2;">☁️ Gravar Auto de Infração</button>
                            <button type="button" class="btn-secondary" onclick="limparFormularios()">🔄 Limpar</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- VIEW 4: CONSULTA CADASTRAL -->
            <div id="view-consulta" class="view-section">
                <h2>Consulta Rápida ao Cadastro Imobiliário</h2>
                <div class="panel-container">
                    <p style="color: #64748b; margin-bottom: 20px;">Pesquise propriedades na base da prefeitura. Você pode buscar pelo lote físico ou pelos dados do proprietário.</p>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        
                        <h3 style="margin-top: 0; font-size: 14px; color: #1b365d;">📍 Opção 1: Busca por Lote (Chave)</h3>
                        <div class="form-row" style="align-items: flex-end;">
                            <div class="form-group"><label>Distr.</label><input type="text" id="consDistrito" placeholder="01"></div>
                            <div class="form-group"><label>Zona</label><input type="text" id="consZona" placeholder="5"></div>
                            <div class="form-group"><label>Quadra</label><input type="text" id="consQuadra" placeholder="071"></div>
                            <div class="form-group"><label>Lote</label><input type="text" id="consLote" placeholder="0015"></div>
                            <div class="form-group">
                                <button class="btn-primary" onclick="buscarConsultaLivre('lote')" style="height: 35px; width: 100%;">🔍 Lote</button>
                            </div>
                        </div>

                        <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 15px 0;">

                        <h3 style="margin-top: 0; font-size: 14px; color: #1b365d;">👤 Opção 2: Busca por Proprietário</h3>
                        <div class="form-row" style="align-items: flex-end;">
                            <div class="form-group" style="flex: 2;">
                                <label>Nome do Proprietário (Digite o início)</label>
                                <input type="text" id="consNome" placeholder="Ex: JOAO DA SILVA">
                            </div>
                            <div class="form-group" style="flex: 1.5;">
                                <label>CPF / CNPJ</label>
                                <input type="text" id="consDoc" placeholder="Ex: 01997677008">
                            </div>
                            <div class="form-group">
                                <button class="btn-secondary" onclick="buscarConsultaLivre('pessoa')" style="height: 35px; width: 100%;">🔍 Pessoa</button>
                            </div>
                        </div>

                        <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 15px 0;">

                        <h3 style="margin-top: 0; font-size: 14px; color: #1b365d;">🏘️ Opção 3: Busca por Endereço Físico</h3>
                        <div class="form-row" style="align-items: flex-end;">
                            <div class="form-group" style="flex: 2;">
                                <label>Nome da Rua (Logradouro)</label>
                                <input type="text" id="consRua" placeholder="Ex: RUA LIVRAMENTO">
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label>Número</label>
                                <input type="text" id="consNumRua" placeholder="Ex: 635">
                            </div>
                            <div class="form-group">
                                <button class="btn-success" onclick="buscarConsultaLivre('endereco')" style="height: 35px; width: 100%;">🔍 Endereço</button>
                            </div>
                        </div>

                    </div>

                    <!-- TABELA DE RESULTADOS -->
                    <div id="resultadoConsulta" style="display: none; margin-top: 20px;">
                        <h3 style="margin-top: 0; color: #16a34a; font-size: 16px;">✅ Imóveis Localizados: <span id="qtdResultadosConsulta">0</span></h3>
                        <div class="table-container" style="max-height: 400px;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Proprietário</th>
                                        <th>CPF/CNPJ</th>
                                        <th>Inscrição (Chave)</th>
                                        <th>Endereço do Lote</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody id="tabelaResultadosConsulta"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VIEW 5: RELATÓRIOS E GRÁFICOS (SUPER PAINEL BI) -->
            <div id="view-relatorios" class="view-section">
                <h2>Painel Executivo de Gestão</h2>
                
                <div class="panel-container" style="display: flex; flex-direction: column;">
                    <h3 style="margin-top: 0; font-size: 15px; color: #1b365d;">📈 Evolução de Demandas (Últimos Meses)</h3>
                    <div style="position: relative; height: 300px; width: 100%;">
                        <canvas id="chartEvolucao"></canvas>
                    </div>
                </div>

                <div class="form-row" style="gap: 15px; margin-bottom: 20px;">
                    <div class="panel-container" style="flex: 1.5; display: flex; flex-direction: column; margin-bottom: 0;">
                        <h3 style="margin-top: 0; font-size: 14px; text-align: center;">📍 Top 10 Bairros Autuados</h3>
                        <div style="position: relative; height: 250px; width: 100%;">
                            <canvas id="chartBairros"></canvas>
                        </div>
                    </div>

                    <div class="panel-container" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0;">
                        <h3 style="margin-top: 0; font-size: 14px; text-align: center;">⚠️ Tipos de Infração</h3>
                        <div style="position: relative; height: 250px; width: 100%;">
                            <canvas id="chartTipos"></canvas>
                        </div>
                    </div>

                    <div class="panel-container" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0;">
                        <h3 style="margin-top: 0; font-size: 14px; text-align: center;">📊 Status Operacional</h3>
                        <div style="position: relative; height: 250px; width: 100%;">
                            <canvas id="chartStatus"></canvas>
                        </div>
                    </div>
                </div>

                <div class="form-row" style="gap: 15px;">
                    <div class="panel-container" style="flex: 1.5; display: flex; flex-direction: column; margin-bottom: 0;">
                        <h3 style="margin-top: 0; font-size: 14px; color: #1b365d;">👨‍💼 Produtividade por Servidor</h3>
                        <div style="position: relative; height: 250px; width: 100%;">
                            <canvas id="chartFiscais"></canvas>
                        </div>
                    </div>

                    <div class="panel-container" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0; justify-content: center; align-items: center; background: #f8fafc; border: 2px dashed #cbd5e1;">
                        <h3 style="margin-top: 0; font-size: 14px; color: #64748b;">💰 Projeção de Arrecadação (Multas Ativas)</h3>
                        <div style="font-size: 40px; font-weight: bold; color: #991b1b; margin: 15px 0;" id="painelFinanceiroValor">R$ 0,00</div>
                        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Valor bruto calculado sobre a URM vigente aplicado aos Autos de Infração gerados na plataforma.</p>
                    </div>
                </div>
            </div>

            <!-- VIEW 6: MEU PERFIL -->
            <div id="view-perfil" class="view-section">
                <h2>Meu Perfil</h2>
                <div class="form-container" style="max-width: 600px;">
                    <p style="color: #64748b; margin-bottom: 20px;">Mantenha seus dados atualizados.</p>
                    <div class="form-group"><label>Nome</label><input type="text" id="perfilNome" disabled style="background:#f1f5f9;"></div>
                    <div class="form-group"><label>Matrícula</label><input type="text" id="perfilMatricula" disabled style="background:#f1f5f9;"></div>
                    <div class="form-group"><label>Setor / Nível</label><input type="text" id="perfilSetorNivel" disabled style="background:#f1f5f9;"></div>
                    <div class="form-group"><label>Telefone Celular</label><input type="text" id="perfilTelefone" placeholder="(54) 99999-9999"></div>
                    <div class="form-group"><label>Nova Senha (opcional)</label><input type="password" id="perfilSenha" placeholder="Digite apenas se quiser trocar"></div>
                    <button class="btn-success" style="margin-top: 15px; width: 100%;">💾 Atualizar Meus Dados</button>
                </div>
            </div>

            <!-- VIEW 7: AUDITORIA -->
            <div id="view-auditoria" class="view-section">
                <h2>Caixa Preta (Logs de Auditoria)</h2>
                <div class="panel-container">
                    <p style="color: #64748b;">Tabela imutável de rastreamento de ações do sistema.</p>
                    <div class="table-container" style="max-height: 500px;">
                        <table class="data-table">
                            <thead>
                                <tr><th>Data/Hora</th><th>Usuário</th><th>Ação Realizada</th><th>Alvo</th></tr>
                            </thead>
                            <tbody id="tabelaAuditoriaCorpo"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- VIEW 8: CONFIGURAÇÕES DO SISTEMA (ADMIN) -->
            <div id="view-configuracoes" class="view-section">
                <h2>Configurações do Sistema</h2>
                
                <div class="dashboard-cards" style="margin-bottom: 20px;">
                    <div class="panel-container" style="flex: 2;">
                        <h3 style="margin-top: 0; color: #1b365d; font-size: 15px;">Gestão de Servidores</h3>
                        <div class="table-container" style="max-height: 400px;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Servidor / Cargo</th>
                                        <th>Secretaria</th>
                                        <th>E-mail</th>
                                        <th>Status</th>
                                        <th>Nível</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody id="tabelaUsuariosCorpo"></tbody>
                            </table>
                        </div>

                        <!-- LISTA VIP DE E-MAILS -->
                        <h3 style="margin-top: 20px; color: #1b365d; font-size: 15px; border-top: 1px dashed #ccc; padding-top: 15px;">Lista VIP (Liberar E-mails Externos)</h3>
                        <p style="font-size:11px; color:#64748b;">E-mails diferentes de @bentogoncalves.rs.gov.br precisam ser adicionados aqui ANTES do cadastro.</p>
                        <div style="display: flex; gap: 10px;">
                            <input type="email" id="adminVipEmail" placeholder="estagiario@gmail.com" style="flex:1;">
                            <button class="btn-secondary" onclick="adicionarEmailVip()">➕ Autorizar</button>
                        </div>
                        <ul id="listaVipEmails" style="font-size: 12px; margin-top: 10px; color: #475569;"></ul>

                    </div>

                    <div style="flex: 1; display: flex; flex-direction: column; gap: 20px;">
                        
                        <div class="panel-container">
                            <h3 style="margin-top: 0; color: #1b365d; font-size: 15px;">Financeiro / Multas</h3>
                            <div class="form-group">
                                <label>Valor da URM Atual (R$)</label>
                                <input type="number" id="configURM" step="0.01" placeholder="Ex: 175.50">
                                <button class="btn-primary" style="margin-top: 10px; width: 100%;">Salvar URM</button>
                            </div>
                        </div>

                        <!-- MÓDULO CORREIOS -->
                        <div class="panel-container" style="border: 2px dashed #f59e0b; background: #fef3c7;">
                            <h3 style="margin-top: 0; color: #b45309; font-size: 15px;">📬 Integração Correios</h3>
                            <p style="font-size: 11px; color: #92400e; line-height: 1.4; margin-bottom: 10px;">Suba o arquivo CSV do VIPP para preencher os Rastreios automaticamente, ou force a sincronização com a API agora.</p>
                            <input type="file" id="fileRetorno" accept=".csv" onchange="importarRetornoCorreios(this.files[0])" style="width: 100%; margin-bottom:10px;">
                            <button class="btn-primary btn-outline" style="width: 100%; border-color:#d97706; color:#d97706;" onclick="verificarRotinaCorreios(true)">🔄 Forçar Sync da API</button>
                        </div>

                        <!-- MÓDULO IPTU DELTA SYNC -->
                        <div class="panel-container" style="border: 2px dashed #38bdf8; background: #f0f9ff;">
                            <h3 style="margin-top: 0; color: #0369a1; font-size: 15px;">Importar IPTU Inteligente (JSON)</h3>
                            <p style="font-size: 11px; color: #475569; line-height: 1.4; margin-bottom: 10px;">O sistema comparará o arquivo novo com o do mês anterior e atualizará apenas as alterações para poupar o banco.</p>
                            <input type="file" id="adminFileJson" accept=".json" style="margin-bottom: 10px; width: 100%;">
                            <button class="btn-success" id="btnAdminImportarIptu" style="width: 100%; margin-top: 5px;">🚀 INICIAR DELTA SYNC</button>
                            <div id="adminProgressoIptu" style="margin-top: 10px; font-size: 11px; font-weight: bold; color: #d97706;"></div>
                        </div>

                        <!-- DOCUMENTAÇÃO DO SISTEMA -->
                        <div class="panel-container" style="background: #1e293b; color: white;">
                            <h3 style="margin-top: 0; color: #38bdf8; font-size: 15px;">📖 Manual da Arquitetura</h3>
                            <div style="font-size:11px; line-height:1.5; color:#cbd5e1; max-height:150px; overflow-y:auto; padding-right:5px;">
                                <strong>Arquitetura:</strong> SPA em Vanilla JS + Firebase Firestore.<br>
                                <strong>Custos (Plano Spark):</strong> Limite de 50.000 leituras/dia e 20.000 escritas/dia.<br>
                                <strong>Segurança:</strong> Firebase Rules bloqueiam usuários não aprovados direto no backend.<br>
                                <strong>Automação Correios:</strong> O primeiro acesso após as 08h e 13h dispara um robô invisível em *background* para varrer os status na BrasilAPI/Linketrack sem custo de servidor.<br>
                                <strong>Cofre IPTU:</strong> A sincronização usa *Client-side Diffing* para comparar o arquivo localmente antes de enviar.<br>
                                <hr style="border-color:#334155; margin:10px 0;">
                                <button class="btn-danger" style="width: 100%; font-size: 10px; padding: 5px;" onclick="corrigirEnderecosAntigos()">🛠️ Injetar Cidade/UF nos Imóveis Antigos</button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </main>
    </div>

    <!-- MODAL FOTOS -->
    <div id="photo-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
            <span class="modal-close" onclick="fecharModalFoto()">&times;</span>
            <img id="modal-image" src="" alt="Evidência Fotográfica Ampliada">
            <div class="modal-actions">
                <button class="btn-primary" onclick="baixarFotoAtual()" style="font-size: 15px; padding: 10px 20px;">⬇️ Baixar Foto (Download)</button>
            </div>
        </div>
    </div>

    <!-- MODAL ESPELHO CADASTRAL -->
    <div id="modal-espelho-cadastral" class="modal-overlay" style="display: none;">
        <div class="modal-content modal-cadastral">
            <div style="background: #1b365d; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0;">
                <h3 style="margin: 0; font-size: 16px;">📄 Espelho Cadastral do Imóvel</h3>
                <span style="font-size: 24px; cursor: pointer; line-height: 1;" onclick="fecharEspelhoCadastral()">&times;</span>
            </div>
            <div style="padding: 20px; max-height: 70vh; overflow-y: auto; text-align: left; width: 100%; box-sizing: border-box;" id="conteudo-espelho"></div>
            <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; text-align: right; background: #fff; border-radius: 0 0 8px 8px;">
                <button class="btn-danger" onclick="autuarDesteEspelho()" style="display: inline-flex; width: auto; margin-right: 10px;">📝 Gerar Notificação deste Lote</button>
                <button class="btn-secondary" onclick="fecharEspelhoCadastral()" style="display: inline-flex; width: auto;">Fechar</button>
            </div>
        </div>
    </div>

    <!-- MODAL EDIÇÃO DE USUÁRIO (NOVO) -->
    <div id="modal-edicao-usuario" class="modal-overlay" style="display: none;">
        <div class="modal-content modal-cadastral" style="max-width: 400px;">
            <div style="background: #1b365d; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0;">
                <h3 style="margin: 0; font-size: 16px;">✏️ Editar Servidor</h3>
                <span style="font-size: 24px; cursor: pointer; line-height: 1;" onclick="fecharModalEdicaoUsuario()">&times;</span>
            </div>
            <div style="padding: 20px; text-align: left; width: 100%; box-sizing: border-box;">
                <input type="hidden" id="editUserId">
                <div class="form-group"><label>Nome Completo</label><input type="text" id="editUserNome"></div>
                <div class="form-group"><label>Cargo</label><input type="text" id="editUserCargo"></div>
                <div class="form-group">
                    <label>Setor / Secretaria</label>
                    <select id="editUserSetor">
                        <option value="SMMAM">SMMAM (Meio Ambiente)</option>
                        <option value="MOBILIDADE">Mobilidade Urbana (Trânsito)</option>
                        <option value="OBRAS">Obras e Posturas</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Telefone</label><input type="text" id="editUserTelefone"></div>
                    <div class="form-group"><label>Matrícula</label><input type="text" id="editUserMatricula"></div>
                </div>
            </div>
            <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; text-align: right; background: #fff; border-radius: 0 0 8px 8px;">
                <button class="btn-success" onclick="salvarEdicaoUsuario()" style="width: 100%;">💾 Salvar Alterações</button>
            </div>
        </div>
    </div>

    <!-- ESPELHO IMPRESSÃO NOTIFICAÇÃO -->
    <div id="print-area">
        <table class="main-grid">
            <tr>
                <td colspan="4" style="width: 65%; padding: 10px;">
                    <div style="font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.3px;">Prefeitura de Bento Gonçalves</div>
                    <div id="printSecretaria" style="font-size: 11px; margin-top: 3px; font-weight: bold;">Secretaria de Meio Ambiente</div>
                    <div style="font-size: 11px; margin-top: 2px;">Setor de Fiscalização</div>
                </td>
                <td colspan="2" style="width: 35%; background-color: #fafafa; vertical-align: middle;">
                    <span class="cell-label">2. DOCUMENTO N°</span>
                    <div class="cell-value" id="pNum" style="font-weight: bold; font-size: 16px; color: #d32f2f; margin-top: 2px;"></div>
                </td>
            </tr>
            <tr>
                <td colspan="4"><span class="cell-label">3. DATA</span><div class="cell-value" id="pData"></div></td>
                <td colspan="2" style="vertical-align: middle;">
                    <div style="display: flex; justify-content: space-around; font-size: 9.5px; font-weight: bold;">
                        <span id="pTipoPresencial">( ) Notificação Presencial</span><span id="pTipoAR">( ) Notificado por AR</span>
                    </div>
                </td>
            </tr>
            <tr><td colspan="6"><span class="cell-label">5. NOME DO NOTIFICADO (OU RAZÃO SOCIAL)</span><div class="cell-value" id="pNome" style="font-weight: bold; text-transform: uppercase;"></div></td></tr>
            <tr>
                <td colspan="4" style="width: 65%;"><span class="cell-label">6. CPF OU CNPJ</span><div class="cell-value" id="pDoc" style="font-weight: bold;"></div></td>
                <td colspan="2" style="width: 35%;"><span class="cell-label">7. CARTEIRA IDENTIDADE/CNTPS</span><div class="cell-value">---</div></td>
            </tr>
            <tr>
                <td colspan="4"><span class="cell-label">8. ENDEREÇO DE CORRESPONDÊNCIA</span><div class="cell-value" id="pEndereco" style="text-transform: uppercase;"></div></td>
                <td colspan="2"><span class="cell-label">9. TELEFONE</span><div class="cell-value" id="pTelefone"></div></td>
            </tr>
            <tr>
                <td colspan="2" style="width: 45%;"><span class="cell-label">10. BAIRRO/DISTRITO</span><div class="cell-value" id="pBairro" style="text-transform: uppercase;"></div></td>
                <td style="width: 20%;"><span class="cell-label">11. MUNICÍPIO</span><div class="cell-value" id="pCidadePrint" style="font-weight: bold;">BENTO GONÇALVES</div></td>
                <td style="width: 25%;"><span class="cell-label">12. CEP</span><div class="cell-value" id="pCep"></div></td>
                <td colspan="2" style="width: 10%;"><span class="cell-label">13. UF</span><div class="cell-value" id="pUfPrint" style="font-weight: bold;">RS</div></td>
            </tr>
            <tr>
                <td style="width: 15%;"><span class="cell-label">DISTRITO</span><div class="cell-value" id="pCadDistrito" style="font-weight: bold; text-align: center;"></div></td>
                <td style="width: 15%;"><span class="cell-label">ZONA</span><div class="cell-value" id="pCadZona" style="font-weight: bold; text-align: center;"></div></td>
                <td style="width: 15%;"><span class="cell-label">QUADRA</span><div class="cell-value" id="pCadQuadra" style="font-weight: bold; text-align: center;"></div></td>
                <td style="width: 20%;"><span class="cell-label">LOTE</span><div class="cell-value" id="pCadLote" style="font-weight: bold; text-align: center;"></div></td>
                <td colspan="2" style="width: 35%; background-color: #fafafa;"><span class="cell-label">CADASTRO IMOBILIÁRIO</span><div class="cell-value" id="pCadImob" style="font-weight: bold; font-size: 12px;"></div></td>
            </tr>
            <tr><td colspan="6" class="alert-row">14. O NÃO ATENDIMENTO DO PRESENTE PODERÁ CONSTITUIR CRIME DE DESOBEDIÊNCIA CONFORME O ARTIGO 330 DO CÓDIGO PENAL</td></tr>
            <tr><td colspan="6" class="section-title">15. MOTIVO DO DOCUMENTO</td></tr>
            <tr>
                <td colspan="6" style="padding: 12px; line-height: 1.45;">
                    <p style="margin: 0 0 10px 0;">Verificação de irregularidade, situada no endereço <strong><span id="pLoteEndereco" style="text-transform: uppercase;"></span></strong>, município de Bento Gonçalves/RS.</p>
                    <p style="margin: 6px 0;"><strong>Ponto de Referência:</strong> <span id="pRef"></span></p>
                    <p style="margin: 6px 0;"><strong>OBS:</strong> <span id="pObs"></span></p>
                    <p style="margin: 15px 0 8px 0; border-top: 1px dashed #000; padding-top: 10px;">
                        <strong><span id="pPrazoImpressao"></span></strong>
                    </p>
                    <p style="margin: 14px 0 0 0; font-weight: bold; text-decoration: underline;">OBSERVAÇÕES (MEIO AMBIENTE):</p>
                    <ul class="bullet-rules">
                        <li>Vegetais arbóreos, lenhosos e nativos deverão ser preservados.</li>
                        <li>Fica proibido o emprego do fogo, bem como, a utilização da capina química para limpeza dos lotes.</li>
                        <li>Após realizada limpeza, fica o notificado obrigado a apresentar levantamento fotográfico comprovando limpeza dos lotes.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td colspan="4" style="width: 65%;">
                    <span class="cell-label">16. Nome do Servidor Responsável</span><div class="cell-value" id="pFiscal" style="font-weight: bold; text-transform: uppercase; margin-bottom: 5px;"></div>
                    <span class="cell-label">17. RE / MATRÍCULA</span><div class="cell-value" id="pMatricula"></div>
                </td>
                <td colspan="2" style="width: 35%;">
                    <span class="cell-label">18. Endereço de Apresentação</span>
                    <div id="pEnderecoSecretaria" class="cell-value" style="font-size: 9.5px; line-height: 1.4;">
                        <strong>SMMAM / Setor Fiscalização</strong><br>Rua 10 de Novembro, 190 – Cidade Alta<br>Fone/whats: 54 3055-7211
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="6" style="padding: 0; border: none;">
                    <div class="signature-container">
                        <div class="sig-box"><br><span class="cell-label">19. Assinatura do Responsável</span></div>
                        <div class="sig-box"><div style="text-align: left; margin-bottom: 12px; font-size: 9.5px;">Recebi o presente em _____/_____/_________</div><span class="cell-label">20. Assinatura do Munícipe</span></div>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <script type="module" src="js/app.js"></script>
</body>
</html>
