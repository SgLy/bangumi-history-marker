import type { Me } from '../types';
import { h } from './dom';

export function createHeader(me: Me, onLogout: () => void): HTMLElement {
  const avatarUrl = me.avatar.large ?? me.avatar.medium ?? me.avatar.small ?? '';
  const avatar = h('span', { className: 'header-avatar' });
  if (avatarUrl) {
    avatar.append(h('img', { attrs: { src: avatarUrl, alt: me.nickname } }));
  } else {
    avatar.textContent = me.nickname.slice(0, 1) || '?';
  }

  const user = h('div', { className: 'header-user' }, [
    avatar,
    h('span', { className: 'header-nickname', text: me.nickname || me.username }),
  ]);

  const logout = h('button', { className: 'btn btn-ghost', text: '退出', attrs: { type: 'button' } });
  logout.addEventListener('click', onLogout);

  return h('header', { className: 'app-header' }, [
    h('div', { className: 'app-brand' }, [
      h('span', { className: 'app-logo', text: '标' }),
      h('h1', { className: 'app-title', text: 'Bangumi 补标助手' }),
    ]),
    h('div', { className: 'header-actions' }, [user, logout]),
  ]);
}
