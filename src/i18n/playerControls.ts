import type { SupportedLanguage } from './index';

const en = {
  player: 'Player', bookActivity: 'Book Activity', gameChat: 'Game Chat', progression: 'XP & AP',
  openSchedule: 'Open schedule', spendPoints: 'Spend XP and AP', unread: 'unread', chat: 'Chat',
  primary: 'Primary', mySchedule: 'My Schedule', quickActions: 'Quick Actions',
  openActions: 'Open quick actions', closeActions: 'Close quick actions',
  switchCharacter: 'Switch character', switched: 'Character switched', updated: 'Game state updated.',
  switchFailed: 'Failed to switch character', slots: 'slots', unnamed: 'Unnamed',
  coma: 'In a coma — select to revive', fame: 'fame', active: 'Active', revive: 'Revive',
  generation: 'Generation', newCharacter: 'New Character', switching: 'Switching character…',
  inProgress: 'In progress', wrappingUp: 'Wrapping up', remaining: 'remaining', currentActivity: 'Current activity',
};

type PlayerControls = Record<keyof typeof en, string>;
const keys = Object.keys(en) as Array<keyof typeof en>;
const fromValues = (values: string[]): PlayerControls => {
  if (values.length !== keys.length) throw new Error('Incomplete player control translations');
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as PlayerControls;
};

export const playerControls: Record<SupportedLanguage, PlayerControls> = {
  en,
  es: fromValues(['Jugador','Reservar actividad','Chat del juego','XP y AP','Abrir agenda','Gastar XP y AP','sin leer','Chat','Principal','Mi agenda','Acciones rápidas','Abrir acciones rápidas','Cerrar acciones rápidas','Cambiar personaje','Personaje cambiado','Estado del juego actualizado.','No se pudo cambiar de personaje','espacios','Sin nombre','En coma — selecciona para revivir','fama','Activo','Revivir','Generación','Nuevo personaje','Cambiando personaje…','En curso','Finalizando','restantes','Actividad actual']),
  zh: fromValues(['玩家','预约活动','游戏聊天','经验与属性点','打开日程','使用经验与属性点','未读','聊天','主导航','我的日程','快捷操作','打开快捷操作','关闭快捷操作','切换角色','角色已切换','游戏状态已更新。','角色切换失败','栏位','未命名','昏迷中 — 选择以复苏','名气','当前角色','复苏','世代','新角色','正在切换角色…','进行中','即将结束','剩余','当前活动']),
  pt: fromValues(['Jogador','Agendar atividade','Chat do jogo','XP e AP','Abrir agenda','Gastar XP e AP','não lidas','Chat','Principal','Minha agenda','Ações rápidas','Abrir ações rápidas','Fechar ações rápidas','Trocar personagem','Personagem trocado','Estado do jogo atualizado.','Não foi possível trocar de personagem','espaços','Sem nome','Em coma — selecione para reviver','fama','Ativo','Reviver','Geração','Novo personagem','Trocando personagem…','Em andamento','Finalizando','restantes','Atividade atual']),
  ja: fromValues(['プレイヤー','アクティビティを予約','ゲームチャット','XP・AP','予定を開く','XP・APを使う','未読','チャット','メイン','マイスケジュール','クイック操作','クイック操作を開く','クイック操作を閉じる','キャラクター切替','キャラクターを切り替えました','ゲーム状態を更新しました。','キャラクターの切替に失敗しました','枠','名前なし','昏睡中 — 選択して復活','名声','使用中','復活','世代','新しいキャラクター','キャラクター切替中…','進行中','終了処理中','残り','現在の活動']),
  de: fromValues(['Spieler','Aktivität buchen','Spielchat','XP und AP','Zeitplan öffnen','XP und AP ausgeben','ungelesen','Chat','Hauptnavigation','Mein Zeitplan','Schnellaktionen','Schnellaktionen öffnen','Schnellaktionen schließen','Charakter wechseln','Charakter gewechselt','Spielstatus aktualisiert.','Charakterwechsel fehlgeschlagen','Plätze','Unbenannt','Im Koma — zum Wiederbeleben auswählen','Ruhm','Aktiv','Wiederbeleben','Generation','Neuer Charakter','Charakter wird gewechselt…','In Bearbeitung','Wird abgeschlossen','verbleibend','Aktuelle Aktivität']),
  fr: fromValues(['Joueur','Réserver une activité','Discussion du jeu','XP et AP','Ouvrir le planning','Dépenser XP et AP','non lus','Discussion','Navigation principale','Mon planning','Actions rapides','Ouvrir les actions rapides','Fermer les actions rapides','Changer de personnage','Personnage changé','État du jeu actualisé.','Impossible de changer de personnage','emplacements','Sans nom','Dans le coma — sélectionner pour réanimer','notoriété','Actif','Réanimer','Génération','Nouveau personnage','Changement de personnage…','En cours','Finalisation','restantes','Activité actuelle']),
  tr: fromValues(['Oyuncu','Etkinlik planla','Oyun sohbeti','XP ve AP','Programı aç','XP ve AP harca','okunmamış','Sohbet','Ana gezinme','Programım','Hızlı işlemler','Hızlı işlemleri aç','Hızlı işlemleri kapat','Karakter değiştir','Karakter değiştirildi','Oyun durumu güncellendi.','Karakter değiştirilemedi','yuva','Adsız','Komada — canlandırmak için seç','şöhret','Aktif','Canlandır','Nesil','Yeni karakter','Karakter değiştiriliyor…','Devam ediyor','Tamamlanıyor','kaldı','Mevcut etkinlik']),
  it: fromValues(['Giocatore','Prenota attività','Chat di gioco','XP e AP','Apri calendario','Spendi XP e AP','non letti','Chat','Navigazione principale','Il mio calendario','Azioni rapide','Apri azioni rapide','Chiudi azioni rapide','Cambia personaggio','Personaggio cambiato','Stato del gioco aggiornato.','Impossibile cambiare personaggio','spazi','Senza nome','In coma — seleziona per rianimare','fama','Attivo','Rianima','Generazione','Nuovo personaggio','Cambio personaggio…','In corso','In conclusione','rimanenti','Attività attuale']),
};