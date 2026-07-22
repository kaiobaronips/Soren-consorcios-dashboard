export const trafficSeries = [
  { label: "01 Jul", operacoes: 1840, sucesso: 1795, erros: 45 },
  { label: "05 Jul", operacoes: 2360, sucesso: 2312, erros: 48 },
  { label: "09 Jul", operacoes: 2184, sucesso: 2131, erros: 53 },
  { label: "13 Jul", operacoes: 2770, sucesso: 2710, erros: 60 },
  { label: "17 Jul", operacoes: 2540, sucesso: 2496, erros: 44 },
  { label: "21 Jul", operacoes: 3120, sucesso: 3061, erros: 59 },
];

export const channelVolume = [
  { name: "Atendimento consultivo", volume: 5640 },
  { name: "Simulações", volume: 4420 },
  { name: "Produtos ativos", volume: 3180 },
  { name: "Revisões pendentes", volume: 1610 },
];

export const distribution = [
  { name: "Atendimento", value: 48, color: "#4589ff" },
  { name: "Simulação", value: 29, color: "#42bea8" },
  { name: "Cadastro", value: 15, color: "#f1c21b" },
  { name: "Importação", value: 8, color: "#a8a8a8" },
];

export const operationalResources = [
  { id: "SIM-10284", recurso: "Simulação residencial", responsavel: "Ana Martins", atualizado: "há 4 min", status: "Ativo" },
  { id: "CLI-04391", recurso: "Cadastro de cliente", responsavel: "Bruno Lima", atualizado: "há 12 min", status: "Ativo" },
  { id: "IMP-00214", recurso: "Importação de tabela", responsavel: "Marina Costa", atualizado: "há 26 min", status: "Atenção" },
  { id: "SIM-10275", recurso: "Simulação de veículo", responsavel: "Ana Martins", atualizado: "há 38 min", status: "Ativo" },
  { id: "PRD-00188", recurso: "Produto empresarial", responsavel: "Bruno Lima", atualizado: "há 1 h", status: "Pendente" },
];

export const inventoryTags = [
  { name: "Imóveis", atual: 42, anterior: 38 },
  { name: "Veículos", atual: 31, anterior: 29 },
  { name: "Serviços", atual: 18, anterior: 16 },
  { name: "Empresarial", atual: 12, anterior: 10 },
  { name: "Em revisão", atual: 8, anterior: 11 },
];

export const inventoryClassification = [
  { name: "Ativo", quantidade: 86, color: "#4589ff" },
  { name: "Rascunho", quantidade: 17, color: "#78a9ff" },
  { name: "Arquivado", quantidade: 8, color: "#a8a8a8" },
];

export const dashboardNavigation = [
  { title: "Visão geral", description: "Indicadores do atendimento, simulações e base comercial.", icon: "LayoutDashboard" },
  { title: "Produtos", description: "Disponibilidade, utilização e desempenho dos planos.", icon: "Package" },
  { title: "Monitoramento", description: "Status operacional, filas e eventos relevantes.", icon: "Activity" },
  { title: "Status", description: "Erros, alertas e sucesso das rotinas de negócio.", icon: "CircleCheck" },
  { title: "Uso", description: "Recursos, produtos e fluxos com maior utilização.", icon: "ChartNoAxesCombined" },
  { title: "Consumo", description: "Volume de operações por equipe e período.", icon: "ReceiptText" },
  { title: "Operações", description: "Tempos de resposta e produtividade operacional.", icon: "Workflow" },
  { title: "Dados", description: "Qualidade, origem e atualização das informações.", icon: "Database" },
];
