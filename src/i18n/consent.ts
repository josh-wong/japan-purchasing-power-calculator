// Text for the analytics consent panel. Kept apart from the page dictionaries so builds without a
// measurement ID, which never load consent-banner.ts, contain none of it.
const en = {
  title: 'Usage analytics',
  description: 'With your permission, this site uses Google Analytics cookies to count visits and see which pages people use. It never sends the amounts you enter or the options you choose.',
  readNotice: 'Read the privacy notice',
  allow: 'Allow analytics',
  decline: 'Decline',
  close: 'Close',
  settings: 'Analytics settings',
  statusSignal: 'Your browser is sending a Global Privacy Control or Do Not Track signal, so analytics stays off.',
  statusAllowed: 'Analytics is currently allowed.',
  statusOff: 'Analytics is currently off.',
  confirmation: (granted: boolean, stored: boolean) =>
    `${granted ? 'Analytics allowed' : 'Analytics off'}${stored ? '' : ' for this visit'}. You can change this anytime with Analytics settings at the bottom of the page.`,
};

export type ConsentMessages = typeof en;

const ja: ConsentMessages = {
  title: '利用状況の分析',
  description: '許可いただいた場合、このサイトは Google アナリティクスの Cookie を使って、訪問数や利用されているページを把握します。入力した金額や選択した項目が送信されることはありません。',
  readNotice: 'プライバシーに関するお知らせを読む',
  allow: '分析を許可',
  decline: '拒否',
  close: '閉じる',
  settings: '分析の設定',
  statusSignal: 'ブラウザーが Global Privacy Control（GPC）または Do Not Track のシグナルを送信しているため、分析はオフのままです。',
  statusAllowed: '現在、分析は許可されています。',
  statusOff: '現在、分析はオフです。',
  confirmation: (granted: boolean, stored: boolean) =>
    `${stored ? '' : '今回の訪問に限り、'}${granted ? '分析を許可しました' : '分析をオフにしました'}。ページ下部の「分析の設定」からいつでも変更できます。`,
};

export const consentMessages = { en, ja };
