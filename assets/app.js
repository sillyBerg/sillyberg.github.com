/* Personal todo list: static page, data kept in this browser's localStorage. */
(() => {
  'use strict';

  const STORAGE_KEY = 'sillyberg.todo.v1';
  const STORAGE_VERSION = 1;
  const MAX_TITLE = 200;

  const form = document.getElementById('new-task-form');
  const input = document.getElementById('new-task');
  const list = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const remaining = document.getElementById('remaining');
  const clearCompleted = document.getElementById('clear-completed');
  const filterButtons = Array.from(document.querySelectorAll('.filter'));

  let state = load();
  let filter = 'all';

  function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normaliseItem(raw) {
    if (!raw || typeof raw.title !== 'string') return null;
    const title = raw.title.trim().slice(0, MAX_TITLE);
    if (!title) return null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      title,
      done: Boolean(raw.done),
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: STORAGE_VERSION, items: [] };
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed && parsed.items) ? parsed.items : [];
      return {
        version: STORAGE_VERSION,
        items: items.map(normaliseItem).filter(Boolean),
      };
    } catch (error) {
      console.warn('读取本地任务失败，已从空列表开始。', error);
      return { version: STORAGE_VERSION, items: [] };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('保存失败：浏览器存储可能已满或被禁用。', error);
    }
  }

  function visibleItems() {
    if (filter === 'active') return state.items.filter((item) => !item.done);
    if (filter === 'completed') return state.items.filter((item) => item.done);
    return state.items;
  }

  function render() {
    const items = visibleItems();
    const fragment = document.createDocumentFragment();

    for (const item of items) fragment.appendChild(renderItem(item));
    list.replaceChildren(fragment);

    emptyState.hidden = items.length > 0;
    emptyState.textContent = state.items.length === 0
      ? '还没有任务，先加一条。'
      : '当前筛选下没有任务。';

    const left = state.items.filter((item) => !item.done).length;
    remaining.textContent = `剩余 ${left} 项`;
    clearCompleted.disabled = !state.items.some((item) => item.done);
  }

  function renderItem(item) {
    const row = document.createElement('li');
    row.className = item.done ? 'task is-done' : 'task';
    row.dataset.id = item.id;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task__check';
    check.checked = item.done;
    check.setAttribute('aria-label', item.done ? '标记为未完成' : '标记为已完成');

    const title = document.createElement('span');
    title.className = 'task__title';
    title.tabIndex = 0;
    title.title = '双击编辑';
    title.textContent = item.title;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task__delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `删除「${item.title}」`);

    row.append(check, title, remove);
    return row;
  }

  function findItem(id) {
    return state.items.find((item) => item.id === id) || null;
  }

  function addTask(title) {
    state.items.unshift({
      id: newId(),
      title: title.slice(0, MAX_TITLE),
      done: false,
      createdAt: Date.now(),
    });
    save();
    render();
  }

  function toggleTask(id) {
    const item = findItem(id);
    if (!item) return;
    item.done = !item.done;
    save();
    render();
  }

  function removeTask(id) {
    state.items = state.items.filter((item) => item.id !== id);
    save();
    render();
  }

  function renameTask(id, title) {
    const item = findItem(id);
    if (!item) return;
    const next = title.trim().slice(0, MAX_TITLE);
    if (next && next !== item.title) {
      item.title = next;
      save();
    }
    render();
  }

  function startEditing(row, item) {
    const title = row.querySelector('.task__title');
    if (!title) return;

    const editor = document.createElement('input');
    editor.type = 'text';
    editor.className = 'task__editor';
    editor.maxLength = MAX_TITLE;
    editor.value = item.title;
    editor.setAttribute('aria-label', '编辑任务');

    title.replaceWith(editor);
    editor.focus();
    editor.select();

    let settled = false;
    const finish = (commit) => {
      if (settled) return;
      settled = true;
      if (commit) renameTask(item.id, editor.value);
      else render();
    };

    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    editor.addEventListener('blur', () => finish(true));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    addTask(title);
    input.value = '';
    input.focus();
  });

  list.addEventListener('change', (event) => {
    const check = event.target.closest('.task__check');
    if (!check) return;
    const row = check.closest('.task');
    if (row) toggleTask(row.dataset.id);
  });

  list.addEventListener('click', (event) => {
    const remove = event.target.closest('.task__delete');
    if (remove) {
      const row = remove.closest('.task');
      if (row) removeTask(row.dataset.id);
      return;
    }
  });

  list.addEventListener('dblclick', (event) => {
    const title = event.target.closest('.task__title');
    if (!title) return;
    const row = title.closest('.task');
    const item = row && findItem(row.dataset.id);
    if (row && item) startEditing(row, item);
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const title = event.target.closest('.task__title');
    if (!title) return;
    event.preventDefault();
    const row = title.closest('.task');
    const item = row && findItem(row.dataset.id);
    if (row && item) startEditing(row, item);
  });

  clearCompleted.addEventListener('click', () => {
    state.items = state.items.filter((item) => !item.done);
    save();
    render();
  });

  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      filter = button.dataset.filter || 'all';
      for (const other of filterButtons) {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      }
      render();
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    render();
  });

  render();
})();
