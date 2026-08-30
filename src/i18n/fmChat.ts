import type { Language, SupportedLanguage } from './index';

type ChatKey =
  | 'chat'
  | 'help'
  | 'recruit'
  | 'closeChat'
  | 'worldQuiet'
  | 'worldPlaceholder'
  | 'helpEmpty'
  | 'helpPlaceholder'
  | 'recruitEmpty'
  | 'recruitPlaceholder'
  | 'bandLocked'
  | 'bandEmpty'
  | 'bandPlaceholder'
  | 'loading'
  | 'addFriends'
  | 'friend'
  | 'defaultEmpty'
  | 'defaultPlaceholder'
  | 'reportMessage'
  | 'sendMessage';

const COPY: Record<SupportedLanguage, Record<ChatKey, string>> = {
  en: { chat: 'Chat', help: 'Help', recruit: 'Recruit', closeChat: 'Close chat', worldQuiet: 'World Chat is quiet — start the conversation.', worldPlaceholder: 'Message World Chat…', helpEmpty: 'Ask anything — players and staff answer here.', helpPlaceholder: 'Ask for help…', recruitEmpty: "Post what you play and which band you're looking for.", recruitPlaceholder: 'Looking for a band / member…', bandLocked: 'Join or form a band to unlock band chat.', bandEmpty: 'No messages in {band} yet.', bandPlaceholder: 'Message {band}…', loading: 'Loading…', addFriends: 'Add friends from Social to start chatting.', friend: 'Friend', defaultEmpty: 'No messages yet — say hello.', defaultPlaceholder: 'Type a message…', reportMessage: 'Report message', sendMessage: 'Send message' },
  es: { chat: 'Chat', help: 'Ayuda', recruit: 'Reclutamiento', closeChat: 'Cerrar chat', worldQuiet: 'El chat mundial está tranquilo — inicia la conversación.', worldPlaceholder: 'Escribe en el chat mundial…', helpEmpty: 'Pregunta lo que quieras — jugadores y equipo responden aquí.', helpPlaceholder: 'Pide ayuda…', recruitEmpty: 'Publica qué tocas y qué banda buscas.', recruitPlaceholder: 'Buscar banda / miembro…', bandLocked: 'Únete a una banda o crea una para desbloquear el chat de banda.', bandEmpty: 'Todavía no hay mensajes en {band}.', bandPlaceholder: 'Escribe a {band}…', loading: 'Cargando…', addFriends: 'Añade amigos desde Social para empezar a chatear.', friend: 'Amigo', defaultEmpty: 'Aún no hay mensajes — saluda.', defaultPlaceholder: 'Escribe un mensaje…', reportMessage: 'Denunciar mensaje', sendMessage: 'Enviar mensaje' },
  zh: { chat: '聊天', help: '帮助', recruit: '招募', closeChat: '关闭聊天', worldQuiet: '世界聊天还很安静 — 来开始对话吧。', worldPlaceholder: '发送到世界聊天…', helpEmpty: '有问题尽管问 — 玩家和工作人员会在这里回答。', helpPlaceholder: '寻求帮助…', recruitEmpty: '发布你演奏的内容以及你想寻找的乐队。', recruitPlaceholder: '寻找乐队 / 成员…', bandLocked: '加入或创建乐队后即可解锁乐队聊天。', bandEmpty: '{band} 还没有消息。', bandPlaceholder: '发送消息到 {band}…', loading: '加载中…', addFriends: '从社交中心添加好友后即可开始聊天。', friend: '好友', defaultEmpty: '还没有消息 — 打个招呼吧。', defaultPlaceholder: '输入消息…', reportMessage: '举报消息', sendMessage: '发送消息' },
  pt: { chat: 'Chat', help: 'Ajuda', recruit: 'Recrutamento', closeChat: 'Fechar chat', worldQuiet: 'O Chat Mundial está quieto — comece a conversa.', worldPlaceholder: 'Mensagem no Chat Mundial…', helpEmpty: 'Pergunte qualquer coisa — jogadores e equipe respondem aqui.', helpPlaceholder: 'Peça ajuda…', recruitEmpty: 'Publique o que você toca e que tipo de banda procura.', recruitPlaceholder: 'Procurando banda / integrante…', bandLocked: 'Entre ou forme uma banda para liberar o chat da banda.', bandEmpty: 'Ainda não há mensagens em {band}.', bandPlaceholder: 'Mensagem para {band}…', loading: 'Carregando…', addFriends: 'Adicione amigos pelo Social para começar a conversar.', friend: 'Amigo', defaultEmpty: 'Ainda não há mensagens — diga oi.', defaultPlaceholder: 'Digite uma mensagem…', reportMessage: 'Denunciar mensagem', sendMessage: 'Enviar mensagem' },
  ja: { chat: 'チャット', help: 'ヘルプ', recruit: '募集', closeChat: 'チャットを閉じる', worldQuiet: 'ワールドチャットは静かです — 会話を始めましょう。', worldPlaceholder: 'ワールドチャットに投稿…', helpEmpty: '何でも質問してください — プレイヤーやスタッフが答えます。', helpPlaceholder: '助けを求める…', recruitEmpty: '担当パートと探しているバンドを投稿しましょう。', recruitPlaceholder: 'バンド / メンバーを探す…', bandLocked: 'バンドに加入または結成するとバンドチャットを利用できます。', bandEmpty: '{band}にはまだメッセージがありません。', bandPlaceholder: '{band}にメッセージ…', loading: '読み込み中…', addFriends: 'ソーシャルでフレンドを追加するとチャットできます。', friend: 'フレンド', defaultEmpty: 'まだメッセージがありません — 挨拶してみましょう。', defaultPlaceholder: 'メッセージを入力…', reportMessage: 'メッセージを報告', sendMessage: 'メッセージを送信' },
  de: { chat: 'Chat', help: 'Hilfe', recruit: 'Rekrutierung', closeChat: 'Chat schließen', worldQuiet: 'Im Weltchat ist es ruhig — starte die Unterhaltung.', worldPlaceholder: 'Nachricht im Weltchat…', helpEmpty: 'Frag einfach — Spieler und Team antworten hier.', helpPlaceholder: 'Um Hilfe bitten…', recruitEmpty: 'Poste, was du spielst und welche Band du suchst.', recruitPlaceholder: 'Band / Mitglied gesucht…', bandLocked: 'Tritt einer Band bei oder gründe eine, um den Bandchat freizuschalten.', bandEmpty: 'Noch keine Nachrichten in {band}.', bandPlaceholder: 'Nachricht an {band}…', loading: 'Lädt…', addFriends: 'Füge über Social Freunde hinzu, um zu chatten.', friend: 'Freund', defaultEmpty: 'Noch keine Nachrichten — sag Hallo.', defaultPlaceholder: 'Nachricht eingeben…', reportMessage: 'Nachricht melden', sendMessage: 'Nachricht senden' },
  fr: { chat: 'Chat', help: 'Aide', recruit: 'Recrutement', closeChat: 'Fermer le chat', worldQuiet: 'Le chat mondial est calme — lancez la conversation.', worldPlaceholder: 'Message dans le chat mondial…', helpEmpty: 'Posez vos questions — joueurs et équipe répondent ici.', helpPlaceholder: "Demander de l’aide…", recruitEmpty: 'Indiquez ce que vous jouez et le groupe que vous recherchez.', recruitPlaceholder: 'Recherche groupe / membre…', bandLocked: 'Rejoignez ou créez un groupe pour débloquer le chat du groupe.', bandEmpty: 'Aucun message dans {band} pour le moment.', bandPlaceholder: 'Message à {band}…', loading: 'Chargement…', addFriends: 'Ajoutez des amis depuis Social pour commencer à discuter.', friend: 'Ami', defaultEmpty: 'Aucun message pour le moment — dites bonjour.', defaultPlaceholder: 'Saisissez un message…', reportMessage: 'Signaler le message', sendMessage: 'Envoyer le message' },
  tr: { chat: 'Sohbet', help: 'Yardım', recruit: 'Üye Arama', closeChat: 'Sohbeti kapat', worldQuiet: 'Dünya Sohbeti sessiz — konuşmayı başlat.', worldPlaceholder: 'Dünya Sohbetine yaz…', helpEmpty: 'İstediğini sor — oyuncular ve ekip burada yanıtlar.', helpPlaceholder: 'Yardım iste…', recruitEmpty: 'Ne çaldığını ve nasıl bir grup aradığını paylaş.', recruitPlaceholder: 'Grup / üye aranıyor…', bandLocked: 'Grup sohbetini açmak için bir gruba katıl veya grup kur.', bandEmpty: '{band} grubunda henüz mesaj yok.', bandPlaceholder: '{band} grubuna mesaj…', loading: 'Yükleniyor…', addFriends: 'Sohbete başlamak için Sosyal bölümünden arkadaş ekle.', friend: 'Arkadaş', defaultEmpty: 'Henüz mesaj yok — merhaba de.', defaultPlaceholder: 'Mesaj yaz…', reportMessage: 'Mesajı bildir', sendMessage: 'Mesaj gönder' },
  it: { chat: 'Chat', help: 'Aiuto', recruit: 'Reclutamento', closeChat: 'Chiudi chat', worldQuiet: 'La chat mondiale è tranquilla — avvia la conversazione.', worldPlaceholder: 'Messaggio nella chat mondiale…', helpEmpty: 'Chiedi qualsiasi cosa — giocatori e staff rispondono qui.', helpPlaceholder: 'Chiedi aiuto…', recruitEmpty: 'Pubblica cosa suoni e quale band stai cercando.', recruitPlaceholder: 'Cerco band / membro…', bandLocked: 'Unisciti o crea una band per sbloccare la chat della band.', bandEmpty: 'Ancora nessun messaggio in {band}.', bandPlaceholder: 'Messaggio a {band}…', loading: 'Caricamento…', addFriends: 'Aggiungi amici da Social per iniziare a chattare.', friend: 'Amico', defaultEmpty: 'Ancora nessun messaggio — saluta.', defaultPlaceholder: 'Scrivi un messaggio…', reportMessage: 'Segnala messaggio', sendMessage: 'Invia messaggio' },
};

const resolveLanguage = (language: Language): SupportedLanguage => language in COPY ? language as SupportedLanguage : 'en';

export const fmChatText = (language: Language, key: ChatKey, values: Record<string, string | number> = {}) => {
  const template = COPY[resolveLanguage(language)][key];
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
};
