import { translations, type Language, type SupportedLanguage } from './index';

const LEGACY_KEY_BY_LABEL: Record<string, string> = {
  Home: 'nav.home',
  Inbox: 'nav.inbox',
  Schedule: 'nav.schedule',
  News: 'nav.news',
  Statistics: 'nav.statistics',
  Advisor: 'nav.advisor',
  "Today's News": 'nav.todaysNews',
  Journal: 'nav.journal',
  Character: 'nav.character',
  Characters: 'nav.characters',
  Wellness: 'nav.wellness',
  Gear: 'nav.gear',
  Legacy: 'nav.legacy',
  'Skin Store': 'nav.skinStore',
  'Tattoo Parlour': 'nav.tattooParlour',
  'Clothing Shop': 'nav.clothingShop',
  Inventory: 'nav.inventory',
  'Hall of Immortals': 'nav.hallOfImmortals',
  Music: 'nav.music',
  Songwriting: 'nav.songwriting',
  Recording: 'nav.recording',
  Releases: 'nav.releases',
  Charts: 'nav.charts',
  'Stage Practice': 'nav.stagePractice',
  'Song Manager': 'nav.songManager',
  'Release Manager': 'nav.releaseManager',
  'Music Videos': 'nav.musicVideos',
  'Streaming Platforms': 'nav.streaming',
  'Country Charts': 'nav.countryCharts',
  'Competitive Charts': 'nav.competitiveCharts',
  'Song Rankings': 'nav.songRankings',
  'Song Market': 'nav.songMarket',
  Band: 'nav.band',
  Tours: 'nav.tours',
  Festivals: 'nav.festivals',
  Awards: 'nav.awards',
  Setlists: 'nav.setlists',
  Rehearsals: 'nav.rehearsals',
  'Band Finder': 'nav.bandFinder',
  'Fame Map': 'nav.bandFameMap',
  Perform: 'nav.perform',
  'Open Mic': 'nav.openMic',
  'Jam Sessions': 'nav.jamSessions',
  Busking: 'nav.busking',
  'Stage Equipment': 'nav.stageEquipment',
  Eurovision: 'nav.eurovision',
  Career: 'nav.career',
  Finances: 'nav.finances',
  Employment: 'nav.employment',
  Offers: 'nav.offers',
  Sponsorships: 'nav.sponsorships',
  Education: 'nav.education',
  Teaching: 'nav.teaching',
  'Producer Career': 'nav.producerCareer',
  Modeling: 'nav.modeling',
  'Clothing Designer': 'nav.clothingDesigner',
  Business: 'nav.business',
  'Record Labels': 'nav.recordLabels',
  Venues: 'nav.venues',
  Merchandise: 'nav.merchandise',
  Media: 'nav.media',
  Radio: 'nav.radio',
  'Radio Stations': 'nav.radioStations',
  'TV Shows': 'nav.tvShows',
  Podcasts: 'nav.podcasts',
  Newspapers: 'nav.newspapers',
  Magazines: 'nav.magazines',
  Websites: 'nav.websites',
  Films: 'nav.films',
  'Self-Promotion': 'nav.selfPr',
  World: 'nav.world',
  Cities: 'nav.cities',
  Travel: 'nav.travel',
  'World Pulse': 'nav.worldPulse',
  Social: 'nav.social',
  Twaater: 'nav.twaater',
  DikCok: 'nav.dikcok',
  Gettit: 'nav.gettit',
  Casino: 'nav.casino',
  Underworld: 'nav.underworld',
  Admin: 'nav.admin',
  Dashboard: 'nav.dashboard',
  'Admin Panel': 'nav.adminPanel',
  Search: 'common.search',
  Messages: 'common.messages',
};

// These labels are intentionally written as product copy rather than word-for-word
// translations. Music-industry terms (gig, rider, open mic, support act, charts,
// sponsorship and PR) use the wording players are most likely to recognise.
const LABELS: Partial<Record<SupportedLanguage, Record<string, string>>> = {
  es: {
    Overview: 'Resumen', Today: 'Hoy', 'Look Back': 'Historial', 'Open Schedule': 'Abrir agenda', 'Plan today': 'Planificar hoy', 'Read Inbox': 'Leer bandeja', 'Unread messages': 'Mensajes sin leer',
    Housing: 'Vivienda', Identity: 'Identidad', 'Edit Character': 'Editar personaje', 'Avatar Designer': 'Diseñador de avatar', Property: 'Propiedades', 'Gear / Equipment': 'Equipo', 'Personal Vehicles': 'Vehículos personales', Family: 'Familia', 'Career Legacy': 'Legado profesional', 'New Avatar': 'Nuevo avatar', 'Design a look': 'Diseñar un estilo', 'Visit Wellness': 'Abrir Bienestar', 'Buy Gear': 'Comprar equipo', 'Switch Character': 'Cambiar personaje',
    Videos: 'Vídeos', Create: 'Crear', 'Recording Studio': 'Estudio de grabación', 'Release & Distribute': 'Lanzar y distribuir', 'Charts & Market': 'Listas y mercado', Charts: 'Listas', 'Global Charts': 'Listas globales', 'Country Charts': 'Listas por país', 'Christmas Charts': 'Listas navideñas', 'Competitive Charts': 'Listas competitivas', 'Write Song': 'Escribir canción', 'Start a new project': 'Iniciar un proyecto', 'Record Track': 'Grabar tema', 'Plan Release': 'Planificar lanzamiento', 'Create Music Video': 'Crear videoclip',
    'Book Gigs': 'Reservar conciertos', 'Your Band': 'Tu banda', Repertoire: 'Repertorio', Chemistry: 'Química', 'Equipment & Crew': 'Equipo y personal', Riders: 'Riders', Vehicles: 'Vehículos', 'Discover Bands': 'Descubrir bandas', Browse: 'Explorar', Rankings: 'Clasificación', 'My Gigs': 'Mis conciertos', 'Battle of the Bands': 'Batalla de bandas', 'Stage Setup': 'Montaje de escenario', 'Tours & Events': 'Giras y eventos', 'Tour Manager': 'Gestor de giras', 'Festival Opportunities': 'Oportunidades en festivales', 'Festival Directory': 'Directorio de festivales', 'Major Events': 'Grandes eventos', 'Book a Gig': 'Reservar un concierto', 'Find a venue': 'Buscar un local', 'Start a Tour': 'Iniciar una gira', 'Hit Open Mic': 'Participar en un micro abierto', 'Find Bandmates': 'Buscar compañeros de banda', Rehearse: 'Ensayar', 'Band Equipment': 'Equipo de la banda', 'Show Crew': 'Equipo de directo', 'Support Opportunities': 'Oportunidades como telonero',
    Money: 'Dinero', 'Work & Learn': 'Trabajo y formación', 'Book Education': 'Reservar formación', 'Book Work': 'Programar trabajo', 'Creative Industries': 'Industrias creativas', 'Public Relations': 'Relaciones públicas', Acting: 'Interpretación', 'View Finances': 'Ver finanzas', 'Cash flow & ledger': 'Flujo de caja y libro mayor', 'Find a Job': 'Buscar empleo', 'Review Offers': 'Revisar ofertas', 'Sign Sponsors': 'Cerrar patrocinios',
    Companies: 'Empresas', Recruitment: 'Contratación', Advertising: 'Publicidad', Labels: 'Sellos', Operations: 'Operaciones', Staff: 'Personal', 'Finance & reports': 'Finanzas e informes', Reports: 'Informes', 'Business types': 'Tipos de negocio', 'Manage Companies': 'Gestionar empresas', 'Review Finances': 'Revisar finanzas', 'Create Job Advert': 'Crear oferta de empleo', 'Browse Public Companies': 'Explorar empresas',
    Hub: 'Centro', TV: 'TV', Press: 'Prensa', Film: 'Cine', Broadcast: 'Radio y TV', Screen: 'Audiovisual', Outbound: 'Promoción', 'PR History': 'Historial de RR. PP.', 'Plan Self-Promotion': 'Planificar autopromoción', 'Push a campaign': 'Impulsar una campaña', 'Pitch to Radio': 'Proponer a radios', 'Pitch to TV': 'Proponer a cadenas de TV', 'Read PR History': 'Ver historial de RR. PP.',
    Pulse: 'Pulso', Politics: 'Política', Explore: 'Explorar', Location: 'Ubicación', 'Found a Festival': 'Crear un festival', Landmarks: 'Lugares emblemáticos', 'Seasonal Events': 'Eventos de temporada', 'World Parliament': 'Parlamento mundial', 'Political Party': 'Partido político', 'Party Standings': 'Clasificación de partidos', 'Politics Career': 'Carrera política', 'Travel Somewhere': 'Viajar', 'Move between cities': 'Moverse entre ciudades', 'Explore Cities': 'Explorar ciudades', 'Check World Pulse': 'Consultar Pulso Mundial', 'View Politics': 'Ver política',
    Nightlife: 'Vida nocturna', Store: 'Tienda', People: 'Comunidad', 'Social Hub': 'Centro social', Friends: 'Amigos', Players: 'Jugadores', Invitations: 'Invitaciones', Platforms: 'Plataformas', 'Twaater Messages': 'Mensajes de Twaater', 'Nightlife & Vice': 'Vida nocturna y ocio', Nightclubs: 'Discotecas', Lottery: 'Lotería', Premium: 'Premium', 'Premium Store': 'Tienda Premium', 'Blind Boxes': 'Cajas sorpresa', 'Post on Twaater': 'Publicar en Twaater', 'Share with fans': 'Compartir con fans', 'Hit a Nightclub': 'Ir a una discoteca', 'Open Messages': 'Abrir mensajes', 'Browse Premium Store': 'Explorar tienda Premium',
    Analytics: 'Analítica', Debug: 'Depuración', 'World Reset': 'Reiniciar mundo', 'Debug Panel': 'Panel de depuración',
    Treasury: 'Tesorería', Projects: 'Proyectos', Laws: 'Leyes', Opinion: 'Opinión', Elections: 'Elecciones', 'City Hall': 'Ayuntamiento', 'Command Centre': 'Centro de mando', 'Treasury & Budget': 'Tesorería y presupuesto', 'Projects & Upgrades': 'Proyectos y mejoras', Government: 'Gobierno', 'Laws & Taxes': 'Leyes e impuestos', 'City Services': 'Servicios municipales', 'Public Opinion': 'Opinión pública', Promises: 'Promesas', 'Campaign Promises': 'Promesas electorales', 'PR & Communications': 'RR. PP. y comunicación', 'Elections & Term': 'Elecciones y mandato', 'City Hall History': 'Historial del ayuntamiento',
  },
  zh: {
    Overview: '概览', Today: '今天', 'Look Back': '回顾', 'Open Schedule': '打开日程', 'Plan today': '安排今天', 'Read Inbox': '查看收件箱', 'Unread messages': '未读消息',
    Housing: '住房', Identity: '身份', 'Edit Character': '编辑角色', 'Avatar Designer': '形象设计器', Property: '资产', 'Gear / Equipment': '装备', 'Personal Vehicles': '个人车辆', Family: '家庭', 'Career Legacy': '职业传承', 'New Avatar': '新建形象', 'Design a look': '设计造型', 'Visit Wellness': '查看健康', 'Buy Gear': '购买装备', 'Switch Character': '切换角色',
    Videos: '视频', Create: '创作', 'Recording Studio': '录音棚', 'Release & Distribute': '发行与分销', 'Charts & Market': '榜单与市场', Charts: '榜单', 'Global Charts': '全球榜单', 'Country Charts': '各国榜单', 'Christmas Charts': '圣诞榜单', 'Competitive Charts': '竞赛榜单', 'Write Song': '创作歌曲', 'Start a new project': '开始新项目', 'Record Track': '录制曲目', 'Plan Release': '规划发行', 'Create Music Video': '制作音乐视频',
    'Book Gigs': '安排演出', 'Your Band': '我的乐队', Repertoire: '曲目库', Chemistry: '默契', 'Equipment & Crew': '设备与团队', Riders: '演出需求', Vehicles: '车辆', 'Discover Bands': '发现乐队', Browse: '浏览', Rankings: '排名', 'My Gigs': '我的演出', 'Battle of the Bands': '乐队对决', 'Stage Setup': '舞台布置', 'Tours & Events': '巡演与活动', 'Tour Manager': '巡演管理', 'Festival Opportunities': '音乐节机会', 'Festival Directory': '音乐节目录', 'Major Events': '大型活动', 'Book a Gig': '安排一场演出', 'Find a venue': '寻找场地', 'Start a Tour': '开始巡演', 'Hit Open Mic': '参加开放麦', 'Find Bandmates': '寻找乐队成员', Rehearse: '排练', 'Band Equipment': '乐队设备', 'Show Crew': '演出团队', 'Support Opportunities': '暖场演出机会',
    Money: '资金', 'Work & Learn': '工作与学习', 'Book Education': '安排学习', 'Book Work': '安排工作', 'Creative Industries': '创意产业', 'Public Relations': '公关', Acting: '演艺', 'View Finances': '查看财务', 'Cash flow & ledger': '现金流与账目', 'Find a Job': '找工作', 'Review Offers': '查看邀约', 'Sign Sponsors': '签约赞助商',
    Companies: '公司', Recruitment: '招聘', Advertising: '广告', Labels: '唱片公司', Operations: '运营', Staff: '员工', 'Finance & reports': '财务与报告', Reports: '报告', 'Business types': '业务类型', 'Manage Companies': '管理公司', 'Review Finances': '查看财务', 'Create Job Advert': '发布招聘广告', 'Browse Public Companies': '浏览公司',
    Hub: '中心', TV: '电视', Press: '新闻媒体', Film: '电影', Broadcast: '广播电视', Screen: '影视', Outbound: '对外推广', 'PR History': '公关历史', 'Plan Self-Promotion': '规划自我宣传', 'Push a campaign': '推广宣传活动', 'Pitch to Radio': '向电台推介', 'Pitch to TV': '向电视台推介', 'Read PR History': '查看公关历史',
    Pulse: '动态', Politics: '政治', Explore: '探索', Location: '所在地', 'Found a Festival': '创办音乐节', Landmarks: '地标', 'Seasonal Events': '季节活动', 'World Parliament': '世界议会', 'Political Party': '政党', 'Party Standings': '政党排名', 'Politics Career': '政治生涯', 'Travel Somewhere': '前往其他城市', 'Move between cities': '在城市之间移动', 'Explore Cities': '探索城市', 'Check World Pulse': '查看世界动态', 'View Politics': '查看政治',
    Nightlife: '夜生活', Store: '商店', People: '玩家社交', 'Social Hub': '社交中心', Friends: '好友', Players: '玩家', Invitations: '邀请', Platforms: '平台', 'Twaater Messages': 'Twaater 消息', 'Nightlife & Vice': '夜生活与娱乐', Nightclubs: '夜店', Lottery: '彩票', Premium: '高级', 'Premium Store': '高级商店', 'Blind Boxes': '盲盒', 'Post on Twaater': '在 Twaater 发帖', 'Share with fans': '与粉丝分享', 'Hit a Nightclub': '去夜店', 'Open Messages': '打开消息', 'Browse Premium Store': '浏览高级商店',
    Analytics: '数据分析', Debug: '调试', 'World Reset': '重置世界', 'Debug Panel': '调试面板',
    Treasury: '财政', Projects: '项目', Laws: '法律', Opinion: '民意', Elections: '选举', 'City Hall': '市政厅', 'Command Centre': '指挥中心', 'Treasury & Budget': '财政与预算', 'Projects & Upgrades': '项目与升级', Government: '政府', 'Laws & Taxes': '法律与税收', 'City Services': '城市服务', 'Public Opinion': '公众支持', Promises: '承诺', 'Campaign Promises': '竞选承诺', 'PR & Communications': '公关与传播', 'Elections & Term': '选举与任期', 'City Hall History': '市政厅历史',
  },
  pt: {
    Overview: 'Visão geral', Today: 'Hoje', 'Look Back': 'Histórico', 'Open Schedule': 'Abrir agenda', 'Plan today': 'Planejar hoje', 'Read Inbox': 'Ler caixa de entrada', 'Unread messages': 'Mensagens não lidas',
    Housing: 'Moradia', Identity: 'Identidade', 'Edit Character': 'Editar personagem', 'Avatar Designer': 'Editor de avatar', Property: 'Patrimônio', 'Gear / Equipment': 'Equipamento', 'Personal Vehicles': 'Veículos pessoais', Family: 'Família', 'Career Legacy': 'Legado da carreira', 'New Avatar': 'Novo avatar', 'Design a look': 'Criar um visual', 'Visit Wellness': 'Abrir Bem-estar', 'Buy Gear': 'Comprar equipamento', 'Switch Character': 'Trocar personagem',
    Videos: 'Vídeos', Create: 'Criar', 'Recording Studio': 'Estúdio de gravação', 'Release & Distribute': 'Lançar e distribuir', 'Charts & Market': 'Paradas e mercado', Charts: 'Paradas', 'Global Charts': 'Paradas globais', 'Country Charts': 'Paradas por país', 'Christmas Charts': 'Paradas de Natal', 'Competitive Charts': 'Paradas competitivas', 'Write Song': 'Compor música', 'Start a new project': 'Iniciar um novo projeto', 'Record Track': 'Gravar faixa', 'Plan Release': 'Planejar lançamento', 'Create Music Video': 'Criar videoclipe',
    'Book Gigs': 'Agendar shows', 'Your Band': 'Sua banda', Repertoire: 'Repertório', Chemistry: 'Entrosamento', 'Equipment & Crew': 'Equipamento e equipe', Riders: 'Riders', Vehicles: 'Veículos', 'Discover Bands': 'Descobrir bandas', Browse: 'Explorar', Rankings: 'Ranking', 'My Gigs': 'Meus shows', 'Battle of the Bands': 'Batalha das Bandas', 'Stage Setup': 'Montagem de palco', 'Tours & Events': 'Turnês e eventos', 'Tour Manager': 'Gerenciador de turnê', 'Festival Opportunities': 'Oportunidades em festivais', 'Festival Directory': 'Diretório de festivais', 'Major Events': 'Grandes eventos', 'Book a Gig': 'Agendar um show', 'Find a venue': 'Encontrar uma casa de shows', 'Start a Tour': 'Iniciar turnê', 'Hit Open Mic': 'Participar de um open mic', 'Find Bandmates': 'Encontrar integrantes', Rehearse: 'Ensaiar', 'Band Equipment': 'Equipamento da banda', 'Show Crew': 'Equipe de shows', 'Support Opportunities': 'Oportunidades de abertura',
    Money: 'Dinheiro', 'Work & Learn': 'Trabalho e estudo', 'Book Education': 'Programar estudos', 'Book Work': 'Agendar trabalho', 'Creative Industries': 'Indústrias criativas', 'Public Relations': 'Relações públicas', Acting: 'Atuação', 'View Finances': 'Ver finanças', 'Cash flow & ledger': 'Fluxo de caixa e livro-caixa', 'Find a Job': 'Procurar emprego', 'Review Offers': 'Revisar ofertas', 'Sign Sponsors': 'Fechar patrocínios',
    Companies: 'Empresas', Recruitment: 'Recrutamento', Advertising: 'Publicidade', Labels: 'Gravadoras', Operations: 'Operações', Staff: 'Equipe', 'Finance & reports': 'Finanças e relatórios', Reports: 'Relatórios', 'Business types': 'Tipos de negócio', 'Manage Companies': 'Gerenciar empresas', 'Review Finances': 'Revisar finanças', 'Create Job Advert': 'Criar anúncio de vaga', 'Browse Public Companies': 'Explorar empresas',
    Hub: 'Central', TV: 'TV', Press: 'Imprensa', Film: 'Cinema', Broadcast: 'Rádio e TV', Screen: 'Audiovisual', Outbound: 'Divulgação', 'PR History': 'Histórico de RP', 'Plan Self-Promotion': 'Planejar autopromoção', 'Push a campaign': 'Impulsionar uma campanha', 'Pitch to Radio': 'Apresentar música às rádios', 'Pitch to TV': 'Apresentar proposta à TV', 'Read PR History': 'Ver histórico de RP',
    Pulse: 'Pulso', Politics: 'Política', Explore: 'Explorar', Location: 'Localização', 'Found a Festival': 'Criar um festival', Landmarks: 'Pontos turísticos', 'Seasonal Events': 'Eventos sazonais', 'World Parliament': 'Parlamento mundial', 'Political Party': 'Partido político', 'Party Standings': 'Classificação dos partidos', 'Politics Career': 'Carreira política', 'Travel Somewhere': 'Viajar', 'Move between cities': 'Viajar entre cidades', 'Explore Cities': 'Explorar cidades', 'Check World Pulse': 'Ver Pulso Mundial', 'View Politics': 'Ver política',
    Nightlife: 'Vida noturna', Store: 'Loja', People: 'Comunidade', 'Social Hub': 'Central social', Friends: 'Amigos', Players: 'Jogadores', Invitations: 'Convites', Platforms: 'Plataformas', 'Twaater Messages': 'Mensagens do Twaater', 'Nightlife & Vice': 'Vida noturna e lazer', Nightclubs: 'Boates', Lottery: 'Loteria', Premium: 'Premium', 'Premium Store': 'Loja Premium', 'Blind Boxes': 'Caixas surpresa', 'Post on Twaater': 'Publicar no Twaater', 'Share with fans': 'Compartilhar com fãs', 'Hit a Nightclub': 'Ir a uma boate', 'Open Messages': 'Abrir mensagens', 'Browse Premium Store': 'Explorar Loja Premium',
    Analytics: 'Análises', Debug: 'Depuração', 'World Reset': 'Reiniciar mundo', 'Debug Panel': 'Painel de depuração',
    Treasury: 'Tesouro', Projects: 'Projetos', Laws: 'Leis', Opinion: 'Opinião', Elections: 'Eleições', 'City Hall': 'Prefeitura', 'Command Centre': 'Centro de comando', 'Treasury & Budget': 'Tesouro e orçamento', 'Projects & Upgrades': 'Projetos e melhorias', Government: 'Governo', 'Laws & Taxes': 'Leis e impostos', 'City Services': 'Serviços municipais', 'Public Opinion': 'Opinião pública', Promises: 'Promessas', 'Campaign Promises': 'Promessas de campanha', 'PR & Communications': 'RP e comunicação', 'Elections & Term': 'Eleições e mandato', 'City Hall History': 'Histórico da prefeitura',
  },
  ja: {
    Overview: '概要', Today: '今日', 'Look Back': '振り返り', 'Open Schedule': '予定を開く', 'Plan today': '今日の予定を立てる', 'Read Inbox': '受信箱を見る', 'Unread messages': '未読メッセージ',
    Housing: '住居', Identity: 'プロフィール', 'Edit Character': 'キャラクター編集', 'Avatar Designer': 'アバターデザイナー', Property: '所有物', 'Gear / Equipment': '機材', 'Personal Vehicles': '個人車両', Family: '家族', 'Career Legacy': 'キャリアの軌跡', 'New Avatar': '新しいアバター', 'Design a look': '外見をデザイン', 'Visit Wellness': 'ウェルネスを開く', 'Buy Gear': '機材を購入', 'Switch Character': 'キャラクター切替',
    Videos: '動画', Create: '制作', 'Recording Studio': 'レコーディングスタジオ', 'Release & Distribute': 'リリース＆配信', 'Charts & Market': 'チャート＆市場', Charts: 'チャート', 'Global Charts': '世界チャート', 'Country Charts': '国別チャート', 'Christmas Charts': 'クリスマスチャート', 'Competitive Charts': '競争ランキング', 'Write Song': '曲を書く', 'Start a new project': '新しいプロジェクトを開始', 'Record Track': '楽曲を録音', 'Plan Release': 'リリースを計画', 'Create Music Video': 'MVを制作',
    'Book Gigs': 'ライブをブッキング', 'Your Band': '所属バンド', Repertoire: 'レパートリー', Chemistry: '相性', 'Equipment & Crew': '機材＆クルー', Riders: 'ライダー', Vehicles: '車両', 'Discover Bands': 'バンドを探す', Browse: '閲覧', Rankings: 'ランキング', 'My Gigs': '自分のライブ', 'Battle of the Bands': 'バンドバトル', 'Stage Setup': 'ステージ構成', 'Tours & Events': 'ツアー＆イベント', 'Tour Manager': 'ツアーマネージャー', 'Festival Opportunities': 'フェス出演機会', 'Festival Directory': 'フェス一覧', 'Major Events': '大型イベント', 'Book a Gig': 'ライブをブッキング', 'Find a venue': '会場を探す', 'Start a Tour': 'ツアーを開始', 'Hit Open Mic': 'オープンマイクに参加', 'Find Bandmates': 'バンドメンバーを探す', Rehearse: 'リハーサルする', 'Band Equipment': 'バンド機材', 'Show Crew': 'ライブクルー', 'Support Opportunities': 'サポート出演の機会',
    Money: 'お金', 'Work & Learn': '仕事＆学習', 'Book Education': '学習を予定する', 'Book Work': '仕事を予定する', 'Creative Industries': 'クリエイティブ業界', 'Public Relations': '広報', Acting: '俳優活動', 'View Finances': '財務を見る', 'Cash flow & ledger': 'キャッシュフロー＆台帳', 'Find a Job': '仕事を探す', 'Review Offers': 'オファーを確認', 'Sign Sponsors': 'スポンサー契約を結ぶ',
    Companies: '会社', Recruitment: '採用', Advertising: '広告', Labels: 'レーベル', Operations: '運営', Staff: 'スタッフ', 'Finance & reports': '財務＆レポート', Reports: 'レポート', 'Business types': '事業タイプ', 'Manage Companies': '会社を管理', 'Review Finances': '財務を確認', 'Create Job Advert': '求人を作成', 'Browse Public Companies': '会社一覧を見る',
    Hub: 'ハブ', TV: 'テレビ', Press: 'プレス', Film: '映画', Broadcast: '放送', Screen: '映像', Outbound: 'プロモーション', 'PR History': '広報履歴', 'Plan Self-Promotion': 'セルフPRを計画', 'Push a campaign': 'キャンペーンを展開', 'Pitch to Radio': 'ラジオに売り込む', 'Pitch to TV': 'テレビに売り込む', 'Read PR History': '広報履歴を見る',
    Pulse: '動向', Politics: '政治', Explore: '探索', Location: '現在地', 'Found a Festival': 'フェスを立ち上げる', Landmarks: 'ランドマーク', 'Seasonal Events': '季節イベント', 'World Parliament': '世界議会', 'Political Party': '政党', 'Party Standings': '政党順位', 'Politics Career': '政治家キャリア', 'Travel Somewhere': '移動する', 'Move between cities': '都市間を移動', 'Explore Cities': '都市を探索', 'Check World Pulse': 'ワールドパルスを見る', 'View Politics': '政治を見る',
    Nightlife: 'ナイトライフ', Store: 'ストア', People: 'コミュニティ', 'Social Hub': 'ソーシャルハブ', Friends: 'フレンド', Players: 'プレイヤー', Invitations: '招待', Platforms: 'プラットフォーム', 'Twaater Messages': 'Twaaterメッセージ', 'Nightlife & Vice': 'ナイトライフ＆娯楽', Nightclubs: 'ナイトクラブ', Lottery: '宝くじ', Premium: 'プレミアム', 'Premium Store': 'プレミアムストア', 'Blind Boxes': 'ブラインドボックス', 'Post on Twaater': 'Twaaterに投稿', 'Share with fans': 'ファンと共有', 'Hit a Nightclub': 'ナイトクラブへ', 'Open Messages': 'メッセージを開く', 'Browse Premium Store': 'プレミアムストアを見る',
    Analytics: '分析', Debug: 'デバッグ', 'World Reset': 'ワールドリセット', 'Debug Panel': 'デバッグパネル',
    Treasury: '財政', Projects: 'プロジェクト', Laws: '法律', Opinion: '世論', Elections: '選挙', 'City Hall': '市役所', 'Command Centre': '市政ダッシュボード', 'Treasury & Budget': '財政＆予算', 'Projects & Upgrades': 'プロジェクト＆改善', Government: '行政', 'Laws & Taxes': '法律＆税金', 'City Services': '市民サービス', 'Public Opinion': '世論', Promises: '公約', 'Campaign Promises': '選挙公約', 'PR & Communications': '広報＆コミュニケーション', 'Elections & Term': '選挙＆任期', 'City Hall History': '市政の履歴',
  },
  de: {
    Overview: 'Übersicht', Today: 'Heute', 'Look Back': 'Rückblick', 'Open Schedule': 'Terminplan öffnen', 'Plan today': 'Heute planen', 'Read Inbox': 'Posteingang öffnen', 'Unread messages': 'Ungelesene Nachrichten',
    Housing: 'Wohnen', Identity: 'Identität', 'Edit Character': 'Charakter bearbeiten', 'Avatar Designer': 'Avatar-Designer', Property: 'Besitz', 'Gear / Equipment': 'Ausrüstung', 'Personal Vehicles': 'Persönliche Fahrzeuge', Family: 'Familie', 'Career Legacy': 'Karrierevermächtnis', 'New Avatar': 'Neuer Avatar', 'Design a look': 'Look gestalten', 'Visit Wellness': 'Wellness öffnen', 'Buy Gear': 'Ausrüstung kaufen', 'Switch Character': 'Charakter wechseln',
    Videos: 'Videos', Create: 'Erstellen', 'Recording Studio': 'Tonstudio', 'Release & Distribute': 'Veröffentlichen & vertreiben', 'Charts & Market': 'Charts & Markt', Charts: 'Charts', 'Global Charts': 'Globale Charts', 'Country Charts': 'Ländercharts', 'Christmas Charts': 'Weihnachtscharts', 'Competitive Charts': 'Wettbewerbscharts', 'Write Song': 'Song schreiben', 'Start a new project': 'Neues Projekt starten', 'Record Track': 'Track aufnehmen', 'Plan Release': 'Release planen', 'Create Music Video': 'Musikvideo erstellen',
    'Book Gigs': 'Auftritte buchen', 'Your Band': 'Deine Band', Repertoire: 'Repertoire', Chemistry: 'Chemie', 'Equipment & Crew': 'Ausrüstung & Crew', Riders: 'Rider', Vehicles: 'Fahrzeuge', 'Discover Bands': 'Bands entdecken', Browse: 'Stöbern', Rankings: 'Ranglisten', 'My Gigs': 'Meine Auftritte', 'Battle of the Bands': 'Battle of the Bands', 'Stage Setup': 'Bühnenaufbau', 'Tours & Events': 'Tourneen & Events', 'Tour Manager': 'Tourmanager', 'Festival Opportunities': 'Festivalchancen', 'Festival Directory': 'Festivalverzeichnis', 'Major Events': 'Großevents', 'Book a Gig': 'Auftritt buchen', 'Find a venue': 'Location finden', 'Start a Tour': 'Tour starten', 'Hit Open Mic': 'Zum Open Mic', 'Find Bandmates': 'Bandmitglieder finden', Rehearse: 'Proben', 'Band Equipment': 'Bandausrüstung', 'Show Crew': 'Live-Crew', 'Support Opportunities': 'Support-Auftritte',
    Money: 'Geld', 'Work & Learn': 'Arbeiten & Lernen', 'Book Education': 'Weiterbildung buchen', 'Book Work': 'Arbeit einplanen', 'Creative Industries': 'Kreativbranchen', 'Public Relations': 'Öffentlichkeitsarbeit', Acting: 'Schauspiel', 'View Finances': 'Finanzen ansehen', 'Cash flow & ledger': 'Cashflow & Hauptbuch', 'Find a Job': 'Job finden', 'Review Offers': 'Angebote prüfen', 'Sign Sponsors': 'Sponsoren gewinnen',
    Companies: 'Unternehmen', Recruitment: 'Personalgewinnung', Advertising: 'Werbung', Labels: 'Labels', Operations: 'Betrieb', Staff: 'Personal', 'Finance & reports': 'Finanzen & Berichte', Reports: 'Berichte', 'Business types': 'Geschäftsarten', 'Manage Companies': 'Unternehmen verwalten', 'Review Finances': 'Finanzen prüfen', 'Create Job Advert': 'Stellenanzeige erstellen', 'Browse Public Companies': 'Unternehmen ansehen',
    Hub: 'Bereich', TV: 'TV', Press: 'Presse', Film: 'Film', Broadcast: 'Rundfunk', Screen: 'Film & TV', Outbound: 'Promotion', 'PR History': 'PR-Verlauf', 'Plan Self-Promotion': 'Eigenwerbung planen', 'Push a campaign': 'Kampagne starten', 'Pitch to Radio': 'Bei Radios pitchen', 'Pitch to TV': 'Bei TV-Sendern pitchen', 'Read PR History': 'PR-Verlauf ansehen',
    Pulse: 'Puls', Politics: 'Politik', Explore: 'Erkunden', Location: 'Standort', 'Found a Festival': 'Festival gründen', Landmarks: 'Sehenswürdigkeiten', 'Seasonal Events': 'Saisonale Events', 'World Parliament': 'Weltparlament', 'Political Party': 'Politische Partei', 'Party Standings': 'Parteien-Rangliste', 'Politics Career': 'Politikkarriere', 'Travel Somewhere': 'Reisen', 'Move between cities': 'Zwischen Städten reisen', 'Explore Cities': 'Städte erkunden', 'Check World Pulse': 'World Pulse prüfen', 'View Politics': 'Politik ansehen',
    Nightlife: 'Nachtleben', Store: 'Shop', People: 'Community', 'Social Hub': 'Social Hub', Friends: 'Freunde', Players: 'Spieler', Invitations: 'Einladungen', Platforms: 'Plattformen', 'Twaater Messages': 'Twaater-Nachrichten', 'Nightlife & Vice': 'Nachtleben & Vergnügen', Nightclubs: 'Nachtclubs', Lottery: 'Lotterie', Premium: 'Premium', 'Premium Store': 'Premium-Shop', 'Blind Boxes': 'Blind Boxes', 'Post on Twaater': 'Auf Twaater posten', 'Share with fans': 'Mit Fans teilen', 'Hit a Nightclub': 'Nachtclub besuchen', 'Open Messages': 'Nachrichten öffnen', 'Browse Premium Store': 'Premium-Shop durchsuchen',
    Analytics: 'Analysen', Debug: 'Debug', 'World Reset': 'Welt zurücksetzen', 'Debug Panel': 'Debug-Panel',
    Treasury: 'Stadtkasse', Projects: 'Projekte', Laws: 'Gesetze', Opinion: 'Meinung', Elections: 'Wahlen', 'City Hall': 'Rathaus', 'Command Centre': 'Kommandozentrale', 'Treasury & Budget': 'Stadtkasse & Haushalt', 'Projects & Upgrades': 'Projekte & Ausbauten', Government: 'Verwaltung', 'Laws & Taxes': 'Gesetze & Steuern', 'City Services': 'Städtische Dienste', 'Public Opinion': 'Öffentliche Meinung', Promises: 'Versprechen', 'Campaign Promises': 'Wahlversprechen', 'PR & Communications': 'PR & Kommunikation', 'Elections & Term': 'Wahlen & Amtszeit', 'City Hall History': 'Rathaus-Chronik',
  },
  fr: {
    Overview: 'Aperçu', Today: "Aujourd'hui", 'Look Back': 'Historique', 'Open Schedule': 'Ouvrir le planning', 'Plan today': 'Planifier la journée', 'Read Inbox': 'Lire la boîte de réception', 'Unread messages': 'Messages non lus',
    Housing: 'Logement', Identity: 'Identité', 'Edit Character': 'Modifier le personnage', 'Avatar Designer': "Créateur d'avatar", Property: 'Biens', 'Gear / Equipment': 'Équipement', 'Personal Vehicles': 'Véhicules personnels', Family: 'Famille', 'Career Legacy': 'Héritage de carrière', 'New Avatar': 'Nouvel avatar', 'Design a look': 'Créer un look', 'Visit Wellness': 'Ouvrir Bien-être', 'Buy Gear': "Acheter de l'équipement", 'Switch Character': 'Changer de personnage',
    Videos: 'Vidéos', Create: 'Créer', 'Recording Studio': "Studio d'enregistrement", 'Release & Distribute': 'Sortir et distribuer', 'Charts & Market': 'Classements et marché', Charts: 'Classements', 'Global Charts': 'Classements mondiaux', 'Country Charts': 'Classements par pays', 'Christmas Charts': 'Classements de Noël', 'Competitive Charts': 'Classements compétitifs', 'Write Song': 'Écrire une chanson', 'Start a new project': 'Démarrer un nouveau projet', 'Record Track': 'Enregistrer un titre', 'Plan Release': 'Planifier une sortie', 'Create Music Video': 'Créer un clip',
    'Book Gigs': 'Réserver des concerts', 'Your Band': 'Votre groupe', Repertoire: 'Répertoire', Chemistry: 'Alchimie', 'Equipment & Crew': 'Équipement et équipe', Riders: 'Riders', Vehicles: 'Véhicules', 'Discover Bands': 'Découvrir des groupes', Browse: 'Parcourir', Rankings: 'Classements', 'My Gigs': 'Mes concerts', 'Battle of the Bands': 'Battle de groupes', 'Stage Setup': 'Configuration de scène', 'Tours & Events': 'Tournées et événements', 'Tour Manager': 'Gestion des tournées', 'Festival Opportunities': 'Opportunités de festivals', 'Festival Directory': 'Annuaire des festivals', 'Major Events': 'Grands événements', 'Book a Gig': 'Réserver un concert', 'Find a venue': 'Trouver une salle', 'Start a Tour': 'Démarrer une tournée', 'Hit Open Mic': 'Participer à une scène ouverte', 'Find Bandmates': 'Trouver des musiciens', Rehearse: 'Répéter', 'Band Equipment': 'Équipement du groupe', 'Show Crew': 'Équipe technique', 'Support Opportunities': 'Opportunités de première partie',
    Money: 'Argent', 'Work & Learn': 'Travail et formation', 'Book Education': 'Réserver une formation', 'Book Work': 'Planifier un travail', 'Creative Industries': 'Industries créatives', 'Public Relations': 'Relations publiques', Acting: 'Jeu d’acteur', 'View Finances': 'Voir les finances', 'Cash flow & ledger': 'Trésorerie et grand livre', 'Find a Job': 'Trouver un emploi', 'Review Offers': 'Examiner les offres', 'Sign Sponsors': 'Signer des partenariats',
    Companies: 'Entreprises', Recruitment: 'Recrutement', Advertising: 'Publicité', Labels: 'Labels', Operations: 'Opérations', Staff: 'Personnel', 'Finance & reports': 'Finances et rapports', Reports: 'Rapports', 'Business types': "Types d'entreprise", 'Manage Companies': 'Gérer les entreprises', 'Review Finances': 'Examiner les finances', 'Create Job Advert': "Créer une offre d'emploi", 'Browse Public Companies': 'Parcourir les entreprises',
    Hub: 'Espace', TV: 'TV', Press: 'Presse', Film: 'Cinéma', Broadcast: 'Diffusion', Screen: 'Audiovisuel', Outbound: 'Promotion', 'PR History': 'Historique RP', 'Plan Self-Promotion': "Planifier l'autopromotion", 'Push a campaign': 'Lancer une campagne', 'Pitch to Radio': 'Proposer aux radios', 'Pitch to TV': 'Proposer aux chaînes TV', 'Read PR History': "Voir l'historique RP",
    Pulse: 'Tendances', Politics: 'Politique', Explore: 'Explorer', Location: 'Lieu', 'Found a Festival': 'Fonder un festival', Landmarks: 'Lieux emblématiques', 'Seasonal Events': 'Événements saisonniers', 'World Parliament': 'Parlement mondial', 'Political Party': 'Parti politique', 'Party Standings': 'Classement des partis', 'Politics Career': 'Carrière politique', 'Travel Somewhere': 'Voyager', 'Move between cities': 'Se déplacer entre les villes', 'Explore Cities': 'Explorer les villes', 'Check World Pulse': 'Consulter World Pulse', 'View Politics': 'Voir la politique',
    Nightlife: 'Vie nocturne', Store: 'Boutique', People: 'Communauté', 'Social Hub': 'Espace social', Friends: 'Amis', Players: 'Joueurs', Invitations: 'Invitations', Platforms: 'Plateformes', 'Twaater Messages': 'Messages Twaater', 'Nightlife & Vice': 'Vie nocturne et loisirs', Nightclubs: 'Boîtes de nuit', Lottery: 'Loterie', Premium: 'Premium', 'Premium Store': 'Boutique Premium', 'Blind Boxes': 'Boîtes mystère', 'Post on Twaater': 'Publier sur Twaater', 'Share with fans': 'Partager avec les fans', 'Hit a Nightclub': 'Aller en boîte', 'Open Messages': 'Ouvrir les messages', 'Browse Premium Store': 'Parcourir la boutique Premium',
    Analytics: 'Analyses', Debug: 'Débogage', 'World Reset': 'Réinitialiser le monde', 'Debug Panel': 'Panneau de débogage',
    Treasury: 'Trésor', Projects: 'Projets', Laws: 'Lois', Opinion: 'Opinion', Elections: 'Élections', 'City Hall': 'Mairie', 'Command Centre': 'Centre de commandement', 'Treasury & Budget': 'Trésor et budget', 'Projects & Upgrades': 'Projets et améliorations', Government: 'Administration', 'Laws & Taxes': 'Lois et impôts', 'City Services': 'Services municipaux', 'Public Opinion': 'Opinion publique', Promises: 'Promesses', 'Campaign Promises': 'Promesses électorales', 'PR & Communications': 'RP et communication', 'Elections & Term': 'Élections et mandat', 'City Hall History': 'Historique de la mairie',
  },
  tr: {
    Overview: 'Genel Bakış', Today: 'Bugün', 'Look Back': 'Geçmiş', 'Open Schedule': 'Takvimi Aç', 'Plan today': 'Bugünü planla', 'Read Inbox': 'Gelen Kutusunu Aç', 'Unread messages': 'Okunmamış mesajlar',
    Housing: 'Konut', Identity: 'Kimlik', 'Edit Character': 'Karakteri Düzenle', 'Avatar Designer': 'Avatar Tasarımcısı', Property: 'Mülk', 'Gear / Equipment': 'Ekipman', 'Personal Vehicles': 'Kişisel Araçlar', Family: 'Aile', 'Career Legacy': 'Kariyer Mirası', 'New Avatar': 'Yeni Avatar', 'Design a look': 'Görünüm tasarla', 'Visit Wellness': 'Sağlık bölümünü aç', 'Buy Gear': 'Ekipman Satın Al', 'Switch Character': 'Karakter Değiştir',
    Videos: 'Videolar', Create: 'Oluştur', 'Recording Studio': 'Kayıt Stüdyosu', 'Release & Distribute': 'Yayınla ve Dağıt', 'Charts & Market': 'Listeler ve Pazar', Charts: 'Listeler', 'Global Charts': 'Dünya Listeleri', 'Country Charts': 'Ülke Listeleri', 'Christmas Charts': 'Noel Listeleri', 'Competitive Charts': 'Rekabetçi Listeler', 'Write Song': 'Şarkı Yaz', 'Start a new project': 'Yeni proje başlat', 'Record Track': 'Parça Kaydet', 'Plan Release': 'Yayın Planla', 'Create Music Video': 'Klip Oluştur',
    'Book Gigs': 'Konser planla', 'Your Band': 'Grubun', Repertoire: 'Repertuvar', Chemistry: 'Uyum', 'Equipment & Crew': 'Ekipman ve Ekip', Riders: 'Rider', Vehicles: 'Araçlar', 'Discover Bands': 'Grupları Keşfet', Browse: 'Göz At', Rankings: 'Sıralamalar', 'My Gigs': 'Konserlerim', 'Battle of the Bands': 'Gruplar Savaşı', 'Stage Setup': 'Sahne Kurulumu', 'Tours & Events': 'Turneler ve Etkinlikler', 'Tour Manager': 'Turne Yöneticisi', 'Festival Opportunities': 'Festival Fırsatları', 'Festival Directory': 'Festival Rehberi', 'Major Events': 'Büyük Etkinlikler', 'Book a Gig': 'Konser planla', 'Find a venue': 'Mekân bul', 'Start a Tour': 'Turne Başlat', 'Hit Open Mic': 'Açık Mikrofona Katıl', 'Find Bandmates': 'Grup Arkadaşı Bul', Rehearse: 'Prova Yap', 'Band Equipment': 'Grup Ekipmanı', 'Show Crew': 'Konser Ekibi', 'Support Opportunities': 'Ön Grup Fırsatları',
    Money: 'Para', 'Work & Learn': 'Çalış ve Öğren', 'Book Education': 'Eğitim planla', 'Book Work': 'İş planla', 'Creative Industries': 'Yaratıcı Sektörler', 'Public Relations': 'Halkla İlişkiler', Acting: 'Oyunculuk', 'View Finances': 'Finansları Gör', 'Cash flow & ledger': 'Nakit akışı ve hesap defteri', 'Find a Job': 'İş Bul', 'Review Offers': 'Teklifleri İncele', 'Sign Sponsors': 'Sponsorlarla Anlaş',
    Companies: 'Şirketler', Recruitment: 'İşe Alım', Advertising: 'Reklam', Labels: 'Plak Şirketleri', Operations: 'Operasyonlar', Staff: 'Personel', 'Finance & reports': 'Finans ve raporlar', Reports: 'Raporlar', 'Business types': 'İşletme türleri', 'Manage Companies': 'Şirketleri Yönet', 'Review Finances': 'Finansları İncele', 'Create Job Advert': 'İş İlanı Oluştur', 'Browse Public Companies': 'Şirketlere göz at',
    Hub: 'Merkez', TV: 'TV', Press: 'Basın', Film: 'Film', Broadcast: 'Yayın', Screen: 'Görsel medya', Outbound: 'Tanıtım', 'PR History': 'PR Geçmişi', 'Plan Self-Promotion': 'Kişisel Tanıtım Planla', 'Push a campaign': 'Kampanya yürüt', 'Pitch to Radio': 'Radyolara sun', 'Pitch to TV': 'TV kanallarına sun', 'Read PR History': 'PR Geçmişini Gör',
    Pulse: 'Nabız', Politics: 'Siyaset', Explore: 'Keşfet', Location: 'Konum', 'Found a Festival': 'Festival Kur', Landmarks: 'Önemli Yerler', 'Seasonal Events': 'Sezonluk Etkinlikler', 'World Parliament': 'Dünya Parlamentosu', 'Political Party': 'Siyasi Parti', 'Party Standings': 'Parti Sıralaması', 'Politics Career': 'Siyasi Kariyer', 'Travel Somewhere': 'Seyahat Et', 'Move between cities': 'Şehirler arasında seyahat et', 'Explore Cities': 'Şehirleri Keşfet', 'Check World Pulse': 'Dünya Nabzını Kontrol Et', 'View Politics': 'Siyaseti Gör',
    Nightlife: 'Gece Hayatı', Store: 'Mağaza', People: 'Topluluk', 'Social Hub': 'Sosyal Merkez', Friends: 'Arkadaşlar', Players: 'Oyuncular', Invitations: 'Davetler', Platforms: 'Platformlar', 'Twaater Messages': 'Twaater Mesajları', 'Nightlife & Vice': 'Gece Hayatı ve Eğlence', Nightclubs: 'Gece Kulüpleri', Lottery: 'Piyango', Premium: 'Premium', 'Premium Store': 'Premium Mağazası', 'Blind Boxes': 'Sürpriz Kutular', 'Post on Twaater': 'Twaater’da Paylaş', 'Share with fans': 'Hayranlarla paylaş', 'Hit a Nightclub': 'Gece Kulübüne Git', 'Open Messages': 'Mesajları Aç', 'Browse Premium Store': 'Premium Mağazasına Göz At',
    Analytics: 'Analizler', Debug: 'Hata Ayıklama', 'World Reset': 'Dünyayı Sıfırla', 'Debug Panel': 'Hata Ayıklama Paneli',
    Treasury: 'Hazine', Projects: 'Projeler', Laws: 'Yasalar', Opinion: 'Kamuoyu', Elections: 'Seçimler', 'City Hall': 'Belediye', 'Command Centre': 'Komuta Merkezi', 'Treasury & Budget': 'Hazine ve Bütçe', 'Projects & Upgrades': 'Projeler ve İyileştirmeler', Government: 'Yönetim', 'Laws & Taxes': 'Yasalar ve Vergiler', 'City Services': 'Şehir Hizmetleri', 'Public Opinion': 'Kamuoyu', Promises: 'Vaatler', 'Campaign Promises': 'Seçim Vaatleri', 'PR & Communications': 'Halkla İlişkiler ve İletişim', 'Elections & Term': 'Seçimler ve Görev Süresi', 'City Hall History': 'Belediye Geçmişi',
  },
  it: {
    Overview: 'Panoramica', Today: 'Oggi', 'Look Back': 'Storico', 'Open Schedule': 'Apri agenda', 'Plan today': 'Pianifica oggi', 'Read Inbox': 'Leggi posta in arrivo', 'Unread messages': 'Messaggi non letti',
    Housing: 'Casa', Identity: 'Identità', 'Edit Character': 'Modifica personaggio', 'Avatar Designer': 'Editor avatar', Property: 'Proprietà', 'Gear / Equipment': 'Equipaggiamento', 'Personal Vehicles': 'Veicoli personali', Family: 'Famiglia', 'Career Legacy': 'Eredità di carriera', 'New Avatar': 'Nuovo avatar', 'Design a look': 'Crea un look', 'Visit Wellness': 'Apri Benessere', 'Buy Gear': 'Compra equipaggiamento', 'Switch Character': 'Cambia personaggio',
    Videos: 'Video', Create: 'Crea', 'Recording Studio': 'Studio di registrazione', 'Release & Distribute': 'Pubblica e distribuisci', 'Charts & Market': 'Classifiche e mercato', Charts: 'Classifiche', 'Global Charts': 'Classifiche globali', 'Country Charts': 'Classifiche nazionali', 'Christmas Charts': 'Classifiche natalizie', 'Competitive Charts': 'Classifiche competitive', 'Write Song': 'Scrivi una canzone', 'Start a new project': 'Avvia un nuovo progetto', 'Record Track': 'Registra un brano', 'Plan Release': 'Pianifica un’uscita', 'Create Music Video': 'Crea un videoclip',
    'Book Gigs': 'Prenota concerti', 'Your Band': 'La tua band', Repertoire: 'Repertorio', Chemistry: 'Intesa', 'Equipment & Crew': 'Attrezzatura e crew', Riders: 'Rider', Vehicles: 'Veicoli', 'Discover Bands': 'Scopri band', Browse: 'Esplora', Rankings: 'Classifiche', 'My Gigs': 'I miei concerti', 'Battle of the Bands': 'Battle delle band', 'Stage Setup': 'Allestimento palco', 'Tours & Events': 'Tour ed eventi', 'Tour Manager': 'Gestione tour', 'Festival Opportunities': 'Opportunità festival', 'Festival Directory': 'Elenco festival', 'Major Events': 'Grandi eventi', 'Book a Gig': 'Prenota un concerto', 'Find a venue': 'Trova un locale', 'Start a Tour': 'Avvia un tour', 'Hit Open Mic': 'Vai all’open mic', 'Find Bandmates': 'Trova membri della band', Rehearse: 'Prova', 'Band Equipment': 'Attrezzatura della band', 'Show Crew': 'Crew live', 'Support Opportunities': 'Opportunità come gruppo spalla',
    Money: 'Denaro', 'Work & Learn': 'Lavoro e formazione', 'Book Education': 'Prenota formazione', 'Book Work': 'Pianifica lavoro', 'Creative Industries': 'Industrie creative', 'Public Relations': 'Pubbliche relazioni', Acting: 'Recitazione', 'View Finances': 'Vedi finanze', 'Cash flow & ledger': 'Flusso di cassa e libro mastro', 'Find a Job': 'Trova lavoro', 'Review Offers': 'Controlla offerte', 'Sign Sponsors': 'Concludi sponsorizzazioni',
    Companies: 'Aziende', Recruitment: 'Reclutamento', Advertising: 'Pubblicità', Labels: 'Etichette discografiche', Operations: 'Operazioni', Staff: 'Personale', 'Finance & reports': 'Finanze e report', Reports: 'Report', 'Business types': 'Tipi di attività', 'Manage Companies': 'Gestisci aziende', 'Review Finances': 'Controlla finanze', 'Create Job Advert': 'Crea annuncio di lavoro', 'Browse Public Companies': 'Esplora aziende',
    Hub: 'Sezione', TV: 'TV', Press: 'Stampa', Film: 'Cinema', Broadcast: 'Trasmissioni', Screen: 'Audiovisivo', Outbound: 'Promozione', 'PR History': 'Storico PR', 'Plan Self-Promotion': 'Pianifica autopromozione', 'Push a campaign': 'Lancia una campagna', 'Pitch to Radio': 'Proponiti alle radio', 'Pitch to TV': 'Proponiti alla TV', 'Read PR History': 'Vedi storico PR',
    Pulse: 'World Pulse', Politics: 'Politica', Explore: 'Esplora', Location: 'Posizione', 'Found a Festival': 'Fonda un festival', Landmarks: 'Luoghi simbolo', 'Seasonal Events': 'Eventi stagionali', 'World Parliament': 'Parlamento mondiale', 'Political Party': 'Partito politico', 'Party Standings': 'Classifica partiti', 'Politics Career': 'Carriera politica', 'Travel Somewhere': 'Viaggia', 'Move between cities': 'Spostati tra le città', 'Explore Cities': 'Esplora città', 'Check World Pulse': 'Controlla World Pulse', 'View Politics': 'Vedi politica',
    Nightlife: 'Vita notturna', Store: 'Negozio', People: 'Comunità', 'Social Hub': 'Hub sociale', Friends: 'Amici', Players: 'Giocatori', Invitations: 'Inviti', Platforms: 'Piattaforme', 'Twaater Messages': 'Messaggi Twaater', 'Nightlife & Vice': 'Vita notturna e svago', Nightclubs: 'Nightclub', Lottery: 'Lotteria', Premium: 'Premium', 'Premium Store': 'Negozio Premium', 'Blind Boxes': 'Scatole misteriose', 'Post on Twaater': 'Pubblica su Twaater', 'Share with fans': 'Condividi con i fan', 'Hit a Nightclub': 'Vai in un nightclub', 'Open Messages': 'Apri messaggi', 'Browse Premium Store': 'Esplora Negozio Premium',
    Analytics: 'Analisi', Debug: 'Debug', 'World Reset': 'Reimposta mondo', 'Debug Panel': 'Pannello debug',
    Treasury: 'Tesoreria', Projects: 'Progetti', Laws: 'Leggi', Opinion: 'Opinione', Elections: 'Elezioni', 'City Hall': 'Municipio', 'Command Centre': 'Centro di comando', 'Treasury & Budget': 'Tesoreria e bilancio', 'Projects & Upgrades': 'Progetti e miglioramenti', Government: 'Amministrazione', 'Laws & Taxes': 'Leggi e tasse', 'City Services': 'Servizi comunali', 'Public Opinion': 'Opinione pubblica', Promises: 'Promesse', 'Campaign Promises': 'Promesse elettorali', 'PR & Communications': 'PR e comunicazione', 'Elections & Term': 'Elezioni e mandato', 'City Hall History': 'Storico del municipio',
  },
};

type FMUiKey =
  | 'skipToMain'
  | 'rockmundoHome'
  | 'goHome'
  | 'liveTheDream'
  | 'artist'
  | 'openCharacterHub'
  | 'gameDate'
  | 'characterStatus'
  | 'openCharacterStatus'
  | 'characterStatusDetails'
  | 'openNavigationSearch'
  | 'searchNavigationShortcut'
  | 'signOut'
  | 'primaryModules'
  | 'manageCity'
  | 'sections'
  | 'back'
  | 'forward'
  | 'cityHallOverview'
  | 'resumeLastPage'
  | 'moduleHub'
  | 'createQuickAction'
  | 'new'
  | 'quickActions'
  | 'expand'
  | 'collapse'
  | 'expandSidebar'
  | 'collapseSidebar'
  | 'favourite'
  | 'favourited'
  | 'addFavourite'
  | 'removeFavourite'
  | 'searchDestinations'
  | 'searchPlaceholder'
  | 'searchHelp'
  | 'noNavigationResults'
  | 'noFavourites'
  | 'favourites'
  | 'recent'
  | 'results'
  | 'commonDestinations';

const UI: Record<SupportedLanguage, Record<FMUiKey, string>> = {
  en: {
    skipToMain: 'Skip to main content', rockmundoHome: 'Rockmundo home', goHome: 'Go to Rockmundo home', liveTheDream: 'Live the dream', artist: 'Artist', openCharacterHub: 'Open character hub for {name}', gameDate: 'Game date', characterStatus: 'Character status', openCharacterStatus: 'Open complete character status', characterStatusDetails: 'Character status details', openNavigationSearch: 'Open navigation search', searchNavigationShortcut: 'Search navigation (Ctrl+K or Cmd+K)', signOut: 'Sign out', primaryModules: 'Primary modules', manageCity: 'Manage {city}', sections: '{module} sections', back: 'Back', forward: 'Forward', cityHallOverview: 'City Hall overview', resumeLastPage: 'Resume last page', moduleHub: '{module} Hub', createQuickAction: 'Create / quick action', new: 'New', quickActions: 'Quick Actions', expand: 'Expand', collapse: 'Collapse', expandSidebar: 'Expand sidebar', collapseSidebar: 'Collapse sidebar', favourite: 'Favourite', favourited: 'Favourited', addFavourite: 'Add {label} to favourites', removeFavourite: 'Remove {label} from favourites', searchDestinations: 'Search navigation destinations', searchPlaceholder: 'Search navigation — pages, hubs and actions…', searchHelp: 'Press Ctrl+K or Cmd+K to open. Search covers navigation destinations, not gameplay data.', noNavigationResults: 'No navigation results for “{query}”. Try browsing the closest hub.', noFavourites: 'No favourites yet. Pin destinations from results or the current page.', favourites: 'Favourites', recent: 'Recent', results: 'Results', commonDestinations: 'Common destinations',
  },
  es: {
    skipToMain: 'Saltar al contenido principal', rockmundoHome: 'Inicio de Rockmundo', goHome: 'Ir al inicio de Rockmundo', liveTheDream: 'Vive el sueño', artist: 'Artista', openCharacterHub: 'Abrir el centro de personaje de {name}', gameDate: 'Fecha del juego', characterStatus: 'Estado del personaje', openCharacterStatus: 'Abrir el estado completo del personaje', characterStatusDetails: 'Detalles del estado del personaje', openNavigationSearch: 'Abrir búsqueda', searchNavigationShortcut: 'Buscar en el menú (Ctrl+K o Cmd+K)', signOut: 'Cerrar sesión', primaryModules: 'Secciones principales', manageCity: 'Gestionar {city}', sections: 'Secciones de {module}', back: 'Atrás', forward: 'Avanzar', cityHallOverview: 'Resumen del ayuntamiento', resumeLastPage: 'Volver a la última página', moduleHub: 'Centro de {module}', createQuickAction: 'Crear / acción rápida', new: 'Nuevo', quickActions: 'Acciones rápidas', expand: 'Expandir', collapse: 'Contraer', expandSidebar: 'Expandir barra lateral', collapseSidebar: 'Contraer barra lateral', favourite: 'Favorito', favourited: 'En favoritos', addFavourite: 'Añadir {label} a favoritos', removeFavourite: 'Quitar {label} de favoritos', searchDestinations: 'Buscar páginas y acciones', searchPlaceholder: 'Buscar páginas, secciones y acciones…', searchHelp: 'Pulsa Ctrl+K o Cmd+K para abrir. Puedes buscar páginas y acciones, no datos del juego.', noNavigationResults: 'No hay resultados para “{query}”. Prueba otra búsqueda o abre una sección relacionada.', noFavourites: 'Aún no hay favoritos. Añádelos desde los resultados o desde la página actual.', favourites: 'Favoritos', recent: 'Recientes', results: 'Resultados', commonDestinations: 'Accesos habituales',
  },
  zh: {
    skipToMain: '跳到主要内容', rockmundoHome: 'Rockmundo 首页', goHome: '前往 Rockmundo 首页', liveTheDream: '实现梦想', artist: '艺人', openCharacterHub: '打开 {name} 的角色中心', gameDate: '游戏日期', characterStatus: '角色状态', openCharacterStatus: '打开角色状态详情', characterStatusDetails: '角色状态详情', openNavigationSearch: '打开搜索', searchNavigationShortcut: '搜索菜单（Ctrl+K 或 Cmd+K）', signOut: '退出登录', primaryModules: '主菜单', manageCity: '管理 {city}', sections: '{module} 页面', back: '后退', forward: '前进', cityHallOverview: '市政厅概览', resumeLastPage: '返回上次页面', moduleHub: '{module} 首页', createQuickAction: '新建 / 快捷操作', new: '新建', quickActions: '快捷操作', expand: '展开', collapse: '收起', expandSidebar: '展开侧栏', collapseSidebar: '收起侧栏', favourite: '收藏', favourited: '已收藏', addFavourite: '将 {label} 加入收藏', removeFavourite: '从收藏中移除 {label}', searchDestinations: '搜索页面和功能', searchPlaceholder: '搜索页面、模块和快捷操作…', searchHelp: '按 Ctrl+K 或 Cmd+K 打开。可搜索页面和功能，不会搜索游戏数据。', noNavigationResults: '没有找到“{query}”。试试其他关键词或打开相关模块。', noFavourites: '还没有收藏。可从搜索结果或当前页面添加。', favourites: '收藏', recent: '最近访问', results: '结果', commonDestinations: '常用入口',
  },
  pt: {
    skipToMain: 'Pular para o conteúdo principal', rockmundoHome: 'Início do Rockmundo', goHome: 'Ir para o início do Rockmundo', liveTheDream: 'Viva o sonho', artist: 'Artista', openCharacterHub: 'Abrir central do personagem de {name}', gameDate: 'Data do jogo', characterStatus: 'Status do personagem', openCharacterStatus: 'Abrir status completo do personagem', characterStatusDetails: 'Detalhes do status do personagem', openNavigationSearch: 'Abrir busca', searchNavigationShortcut: 'Buscar no menu (Ctrl+K ou Cmd+K)', signOut: 'Sair', primaryModules: 'Seções principais', manageCity: 'Gerenciar {city}', sections: 'Seções de {module}', back: 'Voltar', forward: 'Avançar', cityHallOverview: 'Visão geral da prefeitura', resumeLastPage: 'Voltar à última página', moduleHub: 'Central de {module}', createQuickAction: 'Criar / ação rápida', new: 'Novo', quickActions: 'Ações rápidas', expand: 'Expandir', collapse: 'Recolher', expandSidebar: 'Expandir barra lateral', collapseSidebar: 'Recolher barra lateral', favourite: 'Favorito', favourited: 'Nos favoritos', addFavourite: 'Adicionar {label} aos favoritos', removeFavourite: 'Remover {label} dos favoritos', searchDestinations: 'Buscar páginas e ações', searchPlaceholder: 'Buscar páginas, áreas e ações…', searchHelp: 'Pressione Ctrl+K ou Cmd+K para abrir. A busca encontra páginas e ações, não dados do jogo.', noNavigationResults: 'Nenhum resultado para “{query}”. Tente outra busca ou abra uma área relacionada.', noFavourites: 'Nenhum favorito ainda. Adicione pelos resultados ou pela página atual.', favourites: 'Favoritos', recent: 'Recentes', results: 'Resultados', commonDestinations: 'Acessos frequentes',
  },
  ja: {
    skipToMain: 'メインコンテンツへ移動', rockmundoHome: 'Rockmundo ホーム', goHome: 'Rockmundo ホームへ', liveTheDream: '夢を生きよう', artist: 'アーティスト', openCharacterHub: '{name}のキャラクターハブを開く', gameDate: 'ゲーム内日付', characterStatus: 'ステータス', openCharacterStatus: 'ステータス詳細を開く', characterStatusDetails: 'ステータス詳細', openNavigationSearch: '検索を開く', searchNavigationShortcut: 'メニューを検索（Ctrl+K / Cmd+K）', signOut: 'ログアウト', primaryModules: 'メインメニュー', manageCity: '{city}を管理', sections: '{module} のページ', back: '戻る', forward: '進む', cityHallOverview: '市役所の概要', resumeLastPage: '前回のページに戻る', moduleHub: '{module} ホーム', createQuickAction: '作成 / クイックアクション', new: '新規', quickActions: 'クイックアクション', expand: '展開', collapse: '折りたたむ', expandSidebar: 'サイドバーを展開', collapseSidebar: 'サイドバーを折りたたむ', favourite: 'お気に入り', favourited: 'お気に入り済み', addFavourite: '{label}をお気に入りに追加', removeFavourite: '{label}をお気に入りから削除', searchDestinations: 'ページや機能を検索', searchPlaceholder: 'ページ、メニュー、アクションを検索…', searchHelp: 'Ctrl+K または Cmd+K で開きます。ページや機能を検索できます。ゲーム内データは検索しません。', noNavigationResults: '「{query}」に一致するページがありません。別のキーワードを試すか、関連メニューを開いてください。', noFavourites: 'お気に入りはまだありません。検索結果または現在のページから追加できます。', favourites: 'お気に入り', recent: '最近使った項目', results: '結果', commonDestinations: 'よく使う項目',
  },
  de: {
    skipToMain: 'Zum Hauptinhalt springen', rockmundoHome: 'Rockmundo-Startseite', goHome: 'Zur Rockmundo-Startseite', liveTheDream: 'Lebe den Traum', artist: 'Künstler', openCharacterHub: 'Charakterbereich für {name} öffnen', gameDate: 'Spieldatum', characterStatus: 'Charakterstatus', openCharacterStatus: 'Charakterstatus vollständig öffnen', characterStatusDetails: 'Details zum Charakterstatus', openNavigationSearch: 'Suche öffnen', searchNavigationShortcut: 'Menü durchsuchen (Ctrl+K oder Cmd+K)', signOut: 'Abmelden', primaryModules: 'Hauptmenü', manageCity: '{city} verwalten', sections: '{module}-Bereiche', back: 'Zurück', forward: 'Vorwärts', cityHallOverview: 'Rathaus-Übersicht', resumeLastPage: 'Zur letzten Seite', moduleHub: '{module}-Bereich', createQuickAction: 'Erstellen / Schnellaktion', new: 'Neu', quickActions: 'Schnellaktionen', expand: 'Erweitern', collapse: 'Einklappen', expandSidebar: 'Seitenleiste erweitern', collapseSidebar: 'Seitenleiste einklappen', favourite: 'Favorit', favourited: 'Als Favorit markiert', addFavourite: '{label} zu Favoriten hinzufügen', removeFavourite: '{label} aus Favoriten entfernen', searchDestinations: 'Seiten und Funktionen suchen', searchPlaceholder: 'Seiten, Bereiche und Aktionen durchsuchen…', searchHelp: 'Mit Ctrl+K oder Cmd+K öffnen. Die Suche findet Seiten und Funktionen, keine Spieldaten.', noNavigationResults: 'Keine Ergebnisse für „{query}“. Versuche andere Suchbegriffe oder öffne einen passenden Bereich.', noFavourites: 'Noch keine Favoriten. Füge sie aus den Ergebnissen oder von der aktuellen Seite hinzu.', favourites: 'Favoriten', recent: 'Zuletzt', results: 'Ergebnisse', commonDestinations: 'Häufig genutzt',
  },
  fr: {
    skipToMain: 'Aller au contenu principal', rockmundoHome: 'Accueil Rockmundo', goHome: "Aller à l’accueil Rockmundo", liveTheDream: 'Vis le rêve', artist: 'Artiste', openCharacterHub: 'Ouvrir l’espace personnage de {name}', gameDate: 'Date du jeu', characterStatus: 'État du personnage', openCharacterStatus: 'Ouvrir l’état complet du personnage', characterStatusDetails: 'Détails de l’état du personnage', openNavigationSearch: 'Ouvrir la recherche', searchNavigationShortcut: 'Rechercher dans le menu (Ctrl+K ou Cmd+K)', signOut: 'Se déconnecter', primaryModules: 'Sections principales', manageCity: 'Gérer {city}', sections: 'Sections de {module}', back: 'Retour', forward: 'Avancer', cityHallOverview: 'Aperçu de la mairie', resumeLastPage: 'Revenir à la dernière page', moduleHub: 'Espace {module}', createQuickAction: 'Créer / action rapide', new: 'Nouveau', quickActions: 'Actions rapides', expand: 'Développer', collapse: 'Réduire', expandSidebar: 'Développer la barre latérale', collapseSidebar: 'Réduire la barre latérale', favourite: 'Favori', favourited: 'Dans les favoris', addFavourite: 'Ajouter {label} aux favoris', removeFavourite: 'Retirer {label} des favoris', searchDestinations: 'Rechercher des pages et fonctions', searchPlaceholder: 'Rechercher des pages, rubriques et actions…', searchHelp: 'Appuyez sur Ctrl+K ou Cmd+K pour ouvrir. La recherche porte sur les pages et fonctions, pas sur les données du jeu.', noNavigationResults: 'Aucun résultat pour « {query} ». Essayez un autre terme ou ouvrez une rubrique associée.', noFavourites: 'Aucun favori pour le moment. Ajoutez-en depuis les résultats ou la page actuelle.', favourites: 'Favoris', recent: 'Récents', results: 'Résultats', commonDestinations: 'Accès fréquents',
  },
  tr: {
    skipToMain: 'Ana içeriğe geç', rockmundoHome: 'Rockmundo ana sayfası', goHome: 'Rockmundo ana sayfasına git', liveTheDream: 'Hayalini yaşa', artist: 'Sanatçı', openCharacterHub: '{name} karakter sayfasını aç', gameDate: 'Oyun tarihi', characterStatus: 'Karakter durumu', openCharacterStatus: 'Karakter durumu ayrıntılarını aç', characterStatusDetails: 'Karakter durumu ayrıntıları', openNavigationSearch: 'Aramayı aç', searchNavigationShortcut: 'Menüde ara (Ctrl+K veya Cmd+K)', signOut: 'Çıkış yap', primaryModules: 'Ana menü', manageCity: '{city} şehrini yönet', sections: '{module} bölümleri', back: 'Geri', forward: 'İleri', cityHallOverview: 'Belediye genel bakışı', resumeLastPage: 'Son sayfaya dön', moduleHub: '{module} Ana Sayfası', createQuickAction: 'Oluştur / hızlı işlem', new: 'Yeni', quickActions: 'Hızlı İşlemler', expand: 'Genişlet', collapse: 'Daralt', expandSidebar: 'Kenar çubuğunu genişlet', collapseSidebar: 'Kenar çubuğunu daralt', favourite: 'Favori', favourited: 'Favoriye alındı', addFavourite: '{label} öğesini favorilere ekle', removeFavourite: '{label} öğesini favorilerden kaldır', searchDestinations: 'Sayfa ve özellik ara', searchPlaceholder: 'Sayfa, bölüm ve işlemlerde ara…', searchHelp: 'Ctrl+K veya Cmd+K ile açın. Sayfa ve özelliklerde arama yapar; oyun verilerini aramaz.', noNavigationResults: '“{query}” için sonuç bulunamadı. Başka bir terim deneyin veya ilgili bölümü açın.', noFavourites: 'Henüz favori yok. Sonuçlardan veya mevcut sayfadan ekleyebilirsiniz.', favourites: 'Favoriler', recent: 'Son kullanılanlar', results: 'Sonuçlar', commonDestinations: 'Sık kullanılanlar',
  },
  it: {
    skipToMain: 'Vai al contenuto principale', rockmundoHome: 'Home di Rockmundo', goHome: 'Vai alla home di Rockmundo', liveTheDream: 'Vivi il sogno', artist: 'Artista', openCharacterHub: 'Apri la sezione personaggio di {name}', gameDate: 'Data di gioco', characterStatus: 'Stato del personaggio', openCharacterStatus: 'Apri lo stato completo del personaggio', characterStatusDetails: 'Dettagli dello stato del personaggio', openNavigationSearch: 'Apri la ricerca', searchNavigationShortcut: 'Cerca nel menu (Ctrl+K o Cmd+K)', signOut: 'Esci', primaryModules: 'Sezioni principali', manageCity: 'Gestisci {city}', sections: 'Sezioni di {module}', back: 'Indietro', forward: 'Avanti', cityHallOverview: 'Panoramica municipio', resumeLastPage: 'Torna all’ultima pagina', moduleHub: 'Sezione {module}', createQuickAction: 'Crea / azione rapida', new: 'Nuovo', quickActions: 'Azioni rapide', expand: 'Espandi', collapse: 'Comprimi', expandSidebar: 'Espandi barra laterale', collapseSidebar: 'Comprimi barra laterale', favourite: 'Preferito', favourited: 'Nei preferiti', addFavourite: 'Aggiungi {label} ai preferiti', removeFavourite: 'Rimuovi {label} dai preferiti', searchDestinations: 'Cerca pagine e funzioni', searchPlaceholder: 'Cerca pagine, sezioni e azioni…', searchHelp: 'Premi Ctrl+K o Cmd+K per aprire. Cerca pagine e funzioni, non dati di gioco.', noNavigationResults: 'Nessun risultato per “{query}”. Prova un altro termine o apri una sezione correlata.', noFavourites: 'Ancora nessun preferito. Aggiungili dai risultati o dalla pagina corrente.', favourites: 'Preferiti', recent: 'Recenti', results: 'Risultati', commonDestinations: 'Accessi frequenti',
  },
};

const getNestedValue = (obj: unknown, path: string): string | undefined => {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (!current || typeof current !== 'object' || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
};

const resolveLanguage = (language: Language): SupportedLanguage =>
  language in UI ? language as SupportedLanguage : 'en';

export const translateFMLabel = (language: Language, englishLabel: string): string => {
  const locale = resolveLanguage(language);
  if (locale === 'en') return englishLabel;

  const explicit = LABELS[locale]?.[englishLabel];
  if (explicit) return explicit;

  const legacyKey = LEGACY_KEY_BY_LABEL[englishLabel];
  if (legacyKey) {
    const translated = getNestedValue(translations[locale], legacyKey);
    const english = getNestedValue(translations.en, legacyKey);
    if (translated && translated !== english) return translated;
  }

  return englishLabel;
};

export const translateFMText = (
  language: Language,
  key: FMUiKey,
  values: Record<string, string | number> = {},
): string => {
  const template = UI[resolveLanguage(language)][key] ?? UI.en[key];
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
};

export type { FMUiKey };
