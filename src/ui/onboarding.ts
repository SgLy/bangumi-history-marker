import * as api from '../api';
import type { Me } from '../types';
import { h } from './dom';

interface OnboardingOptions {
  message?: string;
  onVerified: (token: string, me: Me) => void;
}

export function createOnboarding(options: OnboardingOptions): HTMLElement {
  const notice = options.message
    ? h('p', { className: 'notice notice-error', text: options.message })
    : null;

  const input = h('input', {
    className: 'token-input',
    attrs: {
      type: 'password',
      placeholder: '粘贴 Access Token',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });

  const submit = h('button', { className: 'btn btn-primary', text: '验证并开始', attrs: { type: 'submit' } });
  const errorLine = h('p', { className: 'form-error', attrs: { hidden: 'hidden' } });

  const form = h('form', { className: 'token-form' }, [input, submit]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = input.value.trim();
    if (!token) {
      showError('请粘贴 Access Token');
      return;
    }
    void submitToken(token);
  });

  async function submitToken(token: string): Promise<void> {
    setBusy(true);
    try {
      const me = await api.verifyToken(token);
      options.onVerified(token, me);
    } catch (error) {
      setBusy(false);
      if (api.isUnauthorized(error)) {
        showError('Token 无效或已过期');
      } else {
        showError(`验证失败：${api.errorMessage(error)}`);
      }
    }
  }

  function showError(message: string): void {
    errorLine.textContent = message;
    errorLine.hidden = false;
  }

  function setBusy(busy: boolean): void {
    input.disabled = busy;
    submit.disabled = busy;
    submit.textContent = busy ? '验证中…' : '验证并开始';
  }

  const element = h('div', { className: 'onboarding' }, [
    h('div', { className: 'onboarding-hero' }, [
      h('h1', { className: 'onboarding-title', text: 'Bangumi 补标助手' }),
      h('p', {
        className: 'onboarding-desc',
        text: '你早就看过，只是一直没标记。按季度浏览热门动画，勾选看过的作品，批量补标为「看过」。',
      }),
    ]),
  ]);
  if (notice) element.append(notice);

  const step1 = h('section', { className: 'card step' }, [
    h('span', { className: 'step-index', text: '1' }),
    h('div', { className: 'step-main' }, [
      h('h2', { className: 'step-title', text: '先在 Bangumi 主站登录' }),
      h('p', {
        className: 'step-text',
        text: '本站无法检测你在主站的登录状态。请确认已登录 Bangumi；还没有账号的话，先注册一个。',
      }),
      h('div', { className: 'step-actions' }, [
        h('a', {
          className: 'btn btn-primary',
          text: '登录 Bangumi',
          attrs: { href: 'https://bgm.tv/login', target: '_blank', rel: 'noreferrer' },
        }),
        h('a', {
          className: 'btn btn-ghost',
          text: '注册新账号',
          attrs: { href: 'https://bgm.tv/signup', target: '_blank', rel: 'noreferrer' },
        }),
      ]),
    ]),
  ]);

  const step2 = h('section', { className: 'card step' }, [
    h('span', { className: 'step-index', text: '2' }),
    h('div', { className: 'step-main' }, [
      h('h2', { className: 'step-title', text: '创建 Access Token' }),
      h('p', { className: 'step-text' }, [
        '前往 ',
        h('a', {
          text: 'next.bgm.tv/demo/access-token/create',
          attrs: {
            href: 'https://next.bgm.tv/demo/access-token/create',
            target: '_blank',
            rel: 'noreferrer',
          },
        }),
        ' 创建 Access Token，创建时请勾选「收藏」相关的写入权限，然后粘贴到下方。',
      ]),
      form,
      errorLine,
    ]),
  ]);

  element.append(step1, step2);
  return element;
}
