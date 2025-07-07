import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    adaptHotkey,
    getFrontend,
    getBackend,
    Setting,
    fetchPost,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData,
    Custom, exitSiYuan, getModelByDockType, getAllEditor, Files, platformUtils, openSetting, openAttributePanel
} from "siyuan";
import "./index.scss";
import {IMenuItem} from "siyuan/types";

const STORAGE_NAME = "menu-config";
const TREE_STATE_STORAGE = "file-tree-state";
const TAB_TYPE = "custom_tab";
const DOCK_TYPE = "dock_tab";

export default class PluginSample extends Plugin {

    private custom: () => Custom;
    private isMobile: boolean;
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private contentMenuEventBindThis = this.contentMenuEvent.bind(this);

    updateProtyleToolbar(toolbar: Array<string | IMenuItem>) {
        toolbar.push("|");
        toolbar.push({
            name: "insert-smail-emoji",
            icon: "iconEmoji",
            hotkey: "⇧⌘I",
            tipPosition: "n",
            tip: this.i18n.insertEmoji,
            click(protyle: Protyle) {
                protyle.insert("😊");
            }
        });
        return toolbar;
    }

    private async initDocTreeDock(dock: any) {
        const level1Container = dock.element.querySelector("#dock-tree-level-1") as HTMLDivElement;
        const level2Container = dock.element.querySelector("#dock-tree-level-2") as HTMLDivElement;
        const level3Container = dock.element.querySelector("#dock-tree-level-3") as HTMLDivElement;
        const search1 = dock.element.querySelector("#dock-search-level-1") as HTMLInputElement;
        const search2 = dock.element.querySelector("#dock-search-level-2") as HTMLInputElement;
        const search3 = dock.element.querySelector("#dock-search-level-3") as HTMLInputElement;

        let currentNotebooks: any[] = [];
        let currentLevel2Docs: any[] = [];
        let currentLevel3Docs: any[] = [];
        
        // 加载保存的状态
        const savedState = await this.loadData(TREE_STATE_STORAGE) || {};
        let currentNotebookId = savedState.currentNotebookId || '';
        let currentLevel2DocPath = savedState.currentLevel2DocPath || '';
        let currentLevel3DocPath = savedState.currentLevel3DocPath || '';

        // 保存状态的函数（包括滚动位置）
        const saveCurrentState = () => {
            const level1ScrollTop = level1Container.scrollTop || 0;
            const level2ScrollTop = level2Container.scrollTop || 0;
            const level3ScrollTop = level3Container.scrollTop || 0;
            
            this.saveData(TREE_STATE_STORAGE, {
                currentNotebookId,
                currentLevel2DocPath,
                currentLevel3DocPath,
                notebooks: currentNotebooks,
                level2Docs: currentLevel2Docs,
                level3Docs: currentLevel3Docs,
                // 新增：滚动位置记录
                scrollPositions: {
                    level1: level1ScrollTop,
                    level2: level2ScrollTop,
                    level3: level3ScrollTop
                },
                // 新增：选中项记录
                selectedItems: {
                    notebookId: currentNotebookId,
                    level2DocPath: currentLevel2DocPath,
                    level3DocPath: currentLevel3DocPath
                }
            });
            
            console.log('状态已保存:', {
                currentNotebookId,
                currentLevel2DocPath,
                currentLevel3DocPath,
                scrollPositions: {
                    level1: level1ScrollTop,
                    level2: level2ScrollTop,
                    level3: level3ScrollTop
                }
            });
        };

        // 定义点击回调函数 - 使用类方法
        const onNotebookClick = (notebook: any) => {
            currentNotebookId = notebook.id;
            this.currentNotebookId = notebook.id;
            const savedLevel2Path = (notebook.id === savedState.currentNotebookId) ? savedState.currentLevel2DocPath : undefined;
            this.loadDocumentsForDock(notebook.id, level2Container, level3Container, currentLevel2Docs, currentLevel3Docs, onLevel2DocClick, savedLevel2Path);
            saveCurrentState();
        };
        
        const onLevel2DocClick = (doc: any) => {
            currentLevel2DocPath = doc.path;
            this.currentLevel2DocPath = doc.path;
            
            // 无论是否有子文档，都在标签页中打开文档
            openTab({
                app: this.app,
                doc: {
                    id: doc.id,
                    action: [Constants.CB_GET_FOCUS]
                }
            });
            
            // 如果有子文档，同时在表3中显示子文档
            if (doc.subFileCount > 0) {
                const savedLevel3Path = (doc.path === savedState.currentLevel2DocPath) ? savedState.currentLevel3DocPath : undefined;
                this.loadSubDocumentsForDock(currentNotebookId, doc.path, level3Container, currentLevel3Docs, onLevel3DocClick, savedLevel3Path);
            } else {
                level3Container.innerHTML = '<div style="color: #888; padding: 4px; font-size: 14px;">无子文档</div>';
                currentLevel3Docs.length = 0;
            }
            saveCurrentState();
        };
        
        const onLevel3DocClick = (doc: any) => {
            currentLevel3DocPath = doc.path;
            // 在新标签页中打开文档
            openTab({
                app: this.app,
                doc: {
                    id: doc.id,
                    action: [Constants.CB_GET_FOCUS]
                }
            });
            saveCurrentState();
        };
        
        // 设置类方法回调
        this.onNotebookClick = onNotebookClick;
        this.onLevel2DocClick = onLevel2DocClick;
        this.onLevel3DocClick = onLevel3DocClick;

        // 添加搜索功能
        search1.addEventListener('input', () => {
            this.filterTreeItemsForDock(currentNotebooks, level1Container, search1.value, onNotebookClick, 'notebook');
        });
        
        search2.addEventListener('input', () => {
            this.filterTreeItemsForDock(currentLevel2Docs, level2Container, search2.value, onLevel2DocClick, 'document');
        });
        
        search3.addEventListener('input', () => {
            this.filterTreeItemsForDock(currentLevel3Docs, level3Container, search3.value, onLevel3DocClick, 'document');
        });

        // 添加滚动事件监听器，实时保存滚动位置
        const throttle = (func: Function, delay: number) => {
            let timeoutId: number;
            return (...args: any[]) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(null, args), delay);
            };
        };

        const throttledSaveState = throttle(saveCurrentState, 300); // 300ms节流

        level1Container.addEventListener('scroll', throttledSaveState);
        level2Container.addEventListener('scroll', throttledSaveState);
        level3Container.addEventListener('scroll', throttledSaveState);

        // 添加获取文档面板信息按钮的点击事件
        const refreshBtn = dock.element.querySelector('#dock-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.getDocumentPanelInfo();
            });
        }

        // 初始加载笔记本，等待加载完成后再恢复状态
        await this.loadNotebooksForDock(level1Container, currentNotebooks, onNotebookClick, currentNotebookId);
        
        // 更新类属性中的笔记本数据
        this.currentNotebooks = [...currentNotebooks];
        
        // 恢复选中项状态（延迟执行，确保DOM已渲染）
        setTimeout(async () => {
            // 先恢复选中项，这会触发数据加载
            await this.restoreSelectedItems(level1Container, level2Container, level3Container, savedState.selectedItems);
            
            // 等待所有数据加载完成后再恢复滚动位置
            setTimeout(() => {
                this.restoreScrollPositions(level1Container, level2Container, level3Container, savedState.scrollPositions);
            }, 200);
        }, 500);
    }

    private async loadNotebooksForDock(container: HTMLElement, notebooks: any[], onNotebookClick: (notebook: any) => void, selectedNotebookId?: string) {
        try {
             const response = await fetch('/api/notebook/lsNotebooks', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({})
             });
             const data = await response.json();
             
             if (data && data.code === 0 && data.data && data.data.notebooks) {
                 notebooks.length = 0;
                 notebooks.push(...data.data.notebooks);
                 // 同时更新类属性
                 this.currentNotebooks.length = 0;
                 this.currentNotebooks.push(...data.data.notebooks);
                 this.renderTreeItemsForDock(notebooks, container, onNotebookClick, 'notebook', selectedNotebookId);
             } else {
                 console.error('加载笔记本失败: 响应格式错误', data);
                 container.innerHTML = '<div style="color: #f00; padding: 4px; font-size: 14px;">加载失败</div>';
             }
         } catch (error) {
             console.error('加载笔记本失败:', error);
             container.innerHTML = '<div style="color: #f00; padding: 4px; font-size: 14px;">加载失败</div>';
         }
    }

    private async loadDocumentsForDock(notebookId: string, container: HTMLElement, level3Container: HTMLElement, docs: any[], level3Docs: any[], onDocClick: (doc: any) => void, selectedDocPath?: string) {
        try {
             const response = await fetch('/api/filetree/listDocsByPath', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     notebook: notebookId,
                     path: '/',
                     maxListCount: 99999
                 })
             });
             const data = await response.json();
             
             if (data && data.code === 0) {
                 // 处理data为null的情况（空目录）
                 if (data.data === null) {
                     console.log('API返回data为null，可能是空目录');
                     docs.length = 0;
                     container.innerHTML = '<div style="padding: 4px; color: #666; font-size: 14px;">暂无文档</div>';
                     return;
                 }
                 
                 // 检查data.files是否存在且为数组
                 if (data.data && data.data.files && Array.isArray(data.data.files)) {
                     docs.length = 0;
                     docs.push(...data.data.files);
                     // 同时更新类属性
                     this.currentLevel2Docs.length = 0;
                     this.currentLevel2Docs.push(...data.data.files);
                     this.renderTreeItemsForDock(docs, container, onDocClick, 'document', selectedDocPath);
                     
                     // 如果有选中的文档且有子文档，自动加载
                     if (selectedDocPath) {
                         const selectedDoc = docs.find(doc => doc.path === selectedDocPath);
                         if (selectedDoc && selectedDoc.subFileCount > 0) {
                             this.loadSubDocumentsForDock(notebookId, selectedDoc.path, level3Container, level3Docs, () => {}, undefined);
                         }
                     }
                 } else {
                     console.warn('API返回的files字段格式异常:', data.data);
                     container.innerHTML = '<div style="padding: 4px; color: #666; font-size: 14px;">数据格式异常</div>';
                 }
             } else {
                 console.error('加载文档失败: API调用失败', data);
                 container.innerHTML = '<div style="color: #f00; padding: 4px; font-size: 14px;">加载失败</div>';
             }
         } catch (error) {
             console.error('加载文档失败:', error);
             container.innerHTML = '<div style="color: #f00; padding: 4px; font-size: 16px;">加载失败</div>';
         }
    }

    private async loadSubDocumentsForDock(notebookId: string, parentPath: string, container: HTMLElement, docs: any[], onDocClick: (doc: any) => void, selectedDocPath?: string) {
        try {
             const response = await fetch('/api/filetree/listDocsByPath', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     notebook: notebookId,
                     path: parentPath,
                     maxListCount: 99999
                 })
             });
             const data = await response.json();
             
             if (data && data.code === 0) {
                 // 处理data为null的情况（空目录或无子文档）
                 if (data.data === null) {
                     console.log('API返回data为null，可能是无子文档');
                     docs.length = 0;
                     container.innerHTML = '<div style="padding: 4px; color: #666; font-size: 14px;">暂无子文档</div>';
                     return;
                 }
                 
                 // 检查data.files是否存在且为数组
                 if (data.data && data.data.files && Array.isArray(data.data.files)) {
                     docs.length = 0;
                     docs.push(...data.data.files);
                     // 同时更新类属性
                     this.currentLevel3Docs.length = 0;
                     this.currentLevel3Docs.push(...data.data.files);
                     this.renderTreeItemsForDock(docs, container, onDocClick, 'document', selectedDocPath);
                 } else {
                     console.warn('API返回的子文档files字段格式异常:', data.data);
                     container.innerHTML = '<div style="padding: 4px; color: #666; font-size: 14px;">数据格式异常</div>';
                 }
             } else {
                 console.error('加载子文档失败: API调用失败', data);
                 container.innerHTML = '<div style="color: #f00; padding: 4px; font-size: 14px;">加载失败</div>';
             }
         } catch (error) {
             console.error('加载子文档失败:', error);
             container.innerHTML = '<div style="color: #f00; padding: 4px; font-size: 16px;">加载失败</div>';
         }
    }

    // 辅助方法：清理标题中的括号数字，如 "文档标题(1)" -> "文档标题"
    private cleanTitle(title: string): string {
        // 使用正则表达式匹配末尾的括号数字，如 (1), (2), (10) 等
        const cleaned = title.replace(/\s*\(\d+\)\s*$/, '');
        if (cleaned !== title) {
            console.log(`标题清理: "${title}" -> "${cleaned}"`);
        }
        return cleaned;
    }

    private renderTreeItemsForDock(items: any[], container: HTMLElement, onItemClick: (item: any) => void, itemType: 'notebook' | 'document', selectedItemId?: string) {
        if (!items || items.length === 0) {
            container.innerHTML = '<div style="color: #888; padding: 4px; font-size: 14px;">暂无数据</div>';
            return;
        }

        console.log('渲染项目列表:', items.map(item => ({ name: item.name, path: item.path })));

        const html = items.map(item => {
            const isSelected = selectedItemId && (itemType === 'notebook' ? item.id === selectedItemId : item.path === selectedItemId);
            // 去掉子文档数量显示
            // const subFileCountText = itemType === 'document' && item.subFileCount > 0 ? ` (${item.subFileCount})` : '';
            // 清理标题中的括号数字
            const cleanedName = this.cleanTitle(item.name);
            console.log(`渲染项目: 原名="${item.name}", 清理后="${cleanedName}"`);
            return `<div class="tree-item ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-path="${item.path || ''}" data-type="${itemType}">
                <span>${cleanedName}</span>
            </div>`;
        }).join('');
        
        container.innerHTML = html;
        
        // 添加点击事件
        container.querySelectorAll('.tree-item').forEach(element => {
            element.addEventListener('click', () => {
                const id = element.getAttribute('data-id');
                const path = element.getAttribute('data-path');
                const type = element.getAttribute('data-type');
                
                // 移除其他选中状态
                container.querySelectorAll('.tree-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // 设置当前选中状态
                element.classList.add('selected');
                
                const item = items.find(i => i.id === id);
                if (item) {
                    onItemClick(item);
                }
            });
            
            // 添加右键菜单
            element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = element.getAttribute('data-id');
                const path = element.getAttribute('data-path');
                const type = element.getAttribute('data-type');
                const item = items.find(i => i.id === id);
                
                if (item) {
                    this.showContextMenuForDock(e, item, itemType, container, items, onItemClick);
                }
            });
        });
    }

    private async showArticleGeneratorDialog() {
        // 读取article_prompt.json文件
        let prompts: string[] = [];
        try {
            const response = await fetch('/plugins/plugin-sample/article_prompt.json');
            if (response.ok) {
                prompts = await response.json();
            }
        } catch (error) {
            console.error('Failed to load article prompts:', error);
            prompts = ['你是一个专业的笔记助手，我会提供一些文字内容，你需要帮我生成一份符合obsidian格式的笔记。'];
        }

        const dialog = new Dialog({
            title: "文章生成界面",
            content: `<div id="articleGeneratorDialog" style="width: 800px; height: 600px; display: flex; gap: 10px; padding: 10px; background: #1a1a1a; color: #ffffff;">
                <!-- 左侧列表 -->
                <div style="width: 300px; border: 1px solid #444; border-radius: 4px; background: #2a2a2a;">
                    <div style="background: #333; padding: 8px; border-bottom: 1px solid #444; font-weight: bold; color: #ffffff;">提示词模板</div>
                    <div id="promptList" style="height: 550px; overflow-y: auto; background: #2a2a2a;"></div>
                </div>
                
                <!-- 右侧输入区域 -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                    <!-- Source输入框 -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #ffffff;">Source:</label>
                        <textarea id="sourceInput" style="width: 100%; height: 120px; padding: 8px; border: 1px solid #444; border-radius: 4px; resize: vertical; background: #2a2a2a; color: #ffffff;" placeholder="请输入源文本内容..."></textarea>
                    </div>
                    
                    <!-- Prompt输入框 -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #ffffff;">Prompt:</label>
                        <textarea id="promptInput" style="width: 100%; height: 120px; padding: 8px; border: 1px solid #444; border-radius: 4px; resize: vertical; background: #2a2a2a; color: #ffffff;" placeholder="请选择或输入提示词..."></textarea>
                    </div>
                    
                    <!-- 按钮区域 -->
                    <div style="display: flex; gap: 10px; margin: 10px 0;">
                        <button id="confirmBtn" style="padding: 8px 16px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
                        <button id="stopBtn" style="padding: 8px 16px; background: #cc3333; color: white; border: none; border-radius: 4px; cursor: pointer;" disabled>终止</button>
                        <button id="cancelBtn" style="padding: 8px 16px; background: #555; color: white; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                    </div>
                    
                    <!-- Output输出框 -->
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #ffffff;">Output:</label>
                        <textarea id="outputArea" style="width: 100%; height: 100%; min-height: 200px; padding: 8px; border: 1px solid #444; border-radius: 4px; resize: vertical; font-family: monospace; background: #2a2a2a; color: #ffffff;" readonly placeholder="生成的文章将在这里显示..."></textarea>
                    </div>
                </div>
            </div>`,
            width: "850px",
            height: "650px"
        });

        // 获取DOM元素
        const promptList = dialog.element.querySelector('#promptList') as HTMLElement;
        const sourceInput = dialog.element.querySelector('#sourceInput') as HTMLTextAreaElement;
        const promptInput = dialog.element.querySelector('#promptInput') as HTMLTextAreaElement;
        const outputArea = dialog.element.querySelector('#outputArea') as HTMLTextAreaElement;
        const confirmBtn = dialog.element.querySelector('#confirmBtn') as HTMLButtonElement;
        const stopBtn = dialog.element.querySelector('#stopBtn') as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector('#cancelBtn') as HTMLButtonElement;

        let currentRequest: AbortController | null = null;

        // 填充提示词列表
        prompts.forEach((prompt, index) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 10px; border-bottom: 1px solid #444; cursor: pointer; transition: background-color 0.2s; color: #ffffff; background: #2a2a2a;';
            item.textContent = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
            item.title = prompt;
            
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#3a3a3a';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = '#2a2a2a';
            });
            
            item.addEventListener('click', () => {
                // 清除其他选中状态
                promptList.querySelectorAll('div').forEach(div => {
                    (div as HTMLElement).style.backgroundColor = '#2a2a2a';
                });
                // 设置当前选中状态
                item.style.backgroundColor = '#0066cc';
                // 加载到Prompt输入框
                promptInput.value = prompt;
            });
            
            promptList.appendChild(item);
        });

        // 确定按钮事件
        confirmBtn.addEventListener('click', async () => {
            const source = sourceInput.value.trim();
            const prompt = promptInput.value.trim();
            
            if (!prompt) {
                showMessage('请输入或选择提示词', 3000, 'error');
                return;
            }
            
            // 构建完整提示词
            let fullPrompt = prompt;
            if (source) {
                fullPrompt = source + '\n==========================\n' + prompt;
            }
            
            // 禁用确定按钮，启用终止按钮
            confirmBtn.disabled = true;
            stopBtn.disabled = false;
            outputArea.value = '生成中...';
            
            try {
                currentRequest = new AbortController();
                
                const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer sk-2d4c7566a3824c778b2f30fcbc620f0d'
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [{
                            role: 'user',
                            content: fullPrompt
                        }],
                        stream: true
                    }),
                    signal: currentRequest.signal
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('Failed to get response reader');
                }
                
                const decoder = new TextDecoder();
                let isFirstContent = true;
                
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    if (isFirstContent) {
                                        outputArea.value = content;
                                        isFirstContent = false;
                                    } else {
                                        outputArea.value += content;
                                    }
                                    outputArea.scrollTop = outputArea.scrollHeight;
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                }
                
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('API request failed:', error);
                    outputArea.value += '\n\n[错误] 请求失败: ' + error.message;
                }
            } finally {
                // 恢复按钮状态
                confirmBtn.disabled = false;
                stopBtn.disabled = true;
                currentRequest = null;
            }
        });
        
        // 终止按钮事件
        stopBtn.addEventListener('click', () => {
            if (currentRequest) {
                currentRequest.abort();
                outputArea.value += '\n\n[已终止]';
            }
        });
        
        // 取消按钮事件
        cancelBtn.addEventListener('click', () => {
            if (currentRequest) {
                currentRequest.abort();
            }
            dialog.destroy();
        });
    }

    private filterTreeItemsForDock(items: any[], container: HTMLElement, searchText: string, onItemClick: (item: any) => void, itemType: 'notebook' | 'document') {
        const filteredItems = items.filter(item => {
            const cleanedName = this.cleanTitle(item.name);
            return cleanedName.toLowerCase().includes(searchText.toLowerCase());
        });
        this.renderTreeItemsForDock(filteredItems, container, onItemClick, itemType);
    }

    private showContextMenuForDock(event: MouseEvent, item: any, itemType: 'notebook' | 'document', container: HTMLElement, items: any[], onItemClick: (item: any) => void) {
        const menu = new Menu("contextMenu");
        
        if (itemType === 'notebook') {
            // 表1的右键菜单
            menu.addItem({
                icon: "iconAdd",
                label: "新建笔记本",
                click: () => {
                    this.createNewNotebook();
                }
            });
            menu.addItem({
                icon: "iconTrashcan",
                label: "删除当前笔记本",
                click: () => {
                    this.deleteNotebook(item.id, container, items, onItemClick);
                }
            });
            menu.addItem({
                icon: "iconAdd",
                label: "添加子文档",
                click: () => {
                    this.addSubDocument(item.id, '/');
                }
            });
            menu.addItem({
                icon: "iconEdit",
                label: "重命名",
                click: async () => {
                    const newName = await this.showInputDialog("重命名笔记本", "请输入新的笔记本名称:", item.name);
                    if (newName && newName !== item.name) {
                        await this.renameNotebook(item.id, newName);
                        await this.refreshDocumentTreesWithStateRestore();
                    }
                }
            });
            menu.addItem({
                icon: "iconCopy",
                label: "复制ID",
                click: () => {
                    navigator.clipboard.writeText(item.id).then(() => {
                        showMessage('ID已复制到剪贴板');
                    }).catch(() => {
                        showMessage('复制失败');
                    });
                }
            });
        } else {
            // 表2和表3的右键菜单
            // 添加"打开文档"选项
            menu.addItem({
                icon: "iconFile",
                label: "打开文档",
                click: () => {
                    this.openDocument(item.id);
                }
            });
            
            menu.addItem({
                icon: "iconAdd",
                label: "在当前目录创建笔记",
                click: () => {
                    const notebookId = this.getCurrentNotebookId();
                    if (notebookId) {
                        if (container.id === 'dock-tree-level-2') {
                            // 表2：在笔记本根目录下创建文档（与当前文档同级）
                            this.addSubDocument(notebookId, '/');
                        } else {
                            // 表3：在当前选中文档的父目录下创建文档
                            const parentPath = item.path ? item.path.substring(0, item.path.lastIndexOf('/')) || '/' : '/';
                            this.addSubDocument(notebookId, parentPath);
                        }
                    } else {
                        showMessage('请先选择一个笔记本');
                    }
                }
            });
            menu.addItem({
                icon: "iconTrashcan",
                label: "删除当前笔记",
                click: () => {
                    this.deleteDocument(item.id, container, items, onItemClick);
                }
            });
            
            // 只有表2才显示"添加子文档"选项
            if (container.id === 'dock-tree-level-2') {
                menu.addItem({
                    icon: "iconAdd",
                    label: "添加子文档",
                    click: () => {
                        // 表2：在当前文档下创建子文档，子文档会出现在表3
                        const notebookId = this.getCurrentNotebookId();
                        if (notebookId) {
                            this.addSubDocumentToLevel3(notebookId, item.path, item.id, item.name);
                        } else {
                            showMessage('请先选择一个笔记本');
                        }
                    }
                });
            }
            
            // 表2和表3都显示"重命名"选项
            menu.addItem({
                icon: "iconEdit",
                label: "重命名",
                click: async () => {
                    const newName = await this.showInputDialog("重命名文档", "请输入新的文档名称:", item.name);
                    if (newName && newName !== item.name) {
                        const notebookId = this.getCurrentNotebookId();
                        if (notebookId) {
                            await this.renameDocument(notebookId, item.path, newName);
                            await this.refreshDocumentTreesWithStateRestore();
                        } else {
                            showMessage('请先选择一个笔记本');
                        }
                    }
                }
            });
            
            // 表2和表3都显示"复制ID"选项
            menu.addItem({
                icon: "iconCopy",
                label: "复制ID",
                click: () => {
                    navigator.clipboard.writeText(item.id).then(() => {
                        showMessage('ID已复制到剪贴板');
                    }).catch(() => {
                        showMessage('复制失败');
                    });
                }
            });
        }
        
        menu.open({
            x: event.clientX,
            y: event.clientY
        });
    }

    private openDocument(docId: string) {
        try {            
            // 根据环境选择合适的打开方式
            if (this.isMobile) {
                // 移动端使用openMobileFileById
                console.log('使用移动端API打开文档');
                openMobileFileById(this.app, docId);
            } else {
                // 桌面端使用openTab
                console.log('使用桌面端API打开文档');
                openTab({
                    app: this.app,
                    doc: {
                        id: docId,
                        action: [Constants.CB_GET_FOCUS]
                    }
                });
            }
        } catch (error) {
            console.error('打开文档失败:', error);
            showMessage(`打开文档失败: ${error.message}`);
        }
    }

    private async createNewNotebook() {
        // 显示输入弹窗
        const notebookName = await this.showInputDialog("新建笔记本", "请输入笔记本名称:", "");
        if (!notebookName || notebookName.trim() === "") {
            return;
        }

        try {
            const response = await fetch('/api/notebook/createNotebook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: notebookName.trim()
                })
            });

            const result = await response.json();
            if (result.code === 0) {
                showMessage(`笔记本 "${notebookName}" 创建成功`);
                
                // 等待思源笔记服务器响应确认后再刷新
                console.log('等待思源笔记服务器确认笔记本创建操作...');
                await this.waitForSiYuanResponse('创建笔记本');
                
                try {
                    console.log('开始刷新文档树...');
                    
                    // 先刷新笔记本列表（表1）
                    await this.refreshNotebookList();
                    
                    // 再刷新文档列表（表2和表3）
                    await this.refreshDocumentLists();
                    
                    // 最后保存历史数据
                    await this.saveHistoryData();
                    
                    console.log('文档树刷新完成');
                    console.log('=== 笔记本创建后刷新完成 ===');
                } catch (refreshError) {
                    console.warn('刷新失败，但笔记本已创建:', refreshError);
                    showMessage('笔记本创建成功，请手动刷新页面查看');
                }
            } else {
                showMessage(`创建笔记本失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('创建笔记本失败:', error);
            showMessage('创建笔记本失败: 网络错误');
        }
    }

    private async deleteNotebook(notebookId: string, container: HTMLElement, items: any[], onItemClick: (item: any) => void) {
        const confirmed = await this.showConfirmDialog("确认删除", "确定要删除这个笔记本吗？此操作不可撤销。");
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/notebook/removeNotebook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook: notebookId
                })
            });

            const result = await response.json();
            if (result.code === 0) {
                showMessage('笔记本删除成功');
                
                // 等待思源笔记服务器响应确认后再刷新
                console.log('等待思源笔记服务器确认笔记本删除操作...');
                await this.waitForSiYuanResponse('删除笔记本');
                
                try {
                    console.log('开始刷新文档树...');
                    
                    // 先刷新笔记本列表（表1）
                    await this.refreshNotebookList();
                    
                    // 再刷新文档列表（表2和表3）
                    await this.refreshDocumentLists();
                    
                    // 最后保存历史数据
                    await this.saveHistoryData();
                    
                    console.log('文档树刷新完成');
                    console.log('=== 笔记本删除后刷新完成 ===');
                } catch (refreshError) {
                    console.warn('刷新失败，但笔记本已删除:', refreshError);
                    showMessage('笔记本删除成功，请手动刷新页面查看');
                }
            } else {
                showMessage(`删除笔记本失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('删除笔记本失败:', error);
            showMessage('删除笔记本失败: 网络错误');
        }
    }

    private async addSubDocument(parentId: string, parentPath: string) {
        // 显示输入弹窗
        const docName = await this.showInputDialog("创建笔记", "请输入笔记名称:", "");
        if (!docName || docName.trim() === "") {
            return;
        }

        try {
            console.log('=== 表3创建笔记 ===');
            console.log('参数信息:', {
                笔记本ID: parentId,
                父目录路径: parentPath,
                笔记名称: docName.trim()
            });

            // 生成新文档ID（参考Python代码的实现）
            const now = new Date();
            const pad = (num: number) => num < 10 ? '0' + num : num.toString();
            const timestamp = now.getFullYear().toString() + 
                            pad(now.getMonth() + 1) + 
                            pad(now.getDate()) + 
                            pad(now.getHours()) + 
                            pad(now.getMinutes()) + 
                            pad(now.getSeconds());
            const randomStr = Math.random().toString(36).substring(2, 9);
            const newDocId = `${timestamp}-${randomStr}`;
            
            // 构建文档路径（参考Python代码的方式）
            const docPath = parentPath === '/' ? `/${newDocId}.sy` : `${parentPath}/${newDocId}.sy`;
            
            console.log('创建笔记信息:', {
                新文档ID: newDocId,
                新文档路径: docPath,
                新文档标题: docName.trim()
            });
            
            // 使用createDoc API创建文档（参考表2的实现）
            const response = await fetch('/api/filetree/createDoc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook: parentId,
                    title: docName.trim(),
                    path: docPath,
                    md: `# ${docName.trim()}\n\n这是一个新创建的笔记。`
                })
            });

            const result = await response.json();
            console.log('创建笔记API响应:', result);
            
            if (result.code === 0) {
                showMessage(`笔记 "${docName}" 创建成功`);
                
                // 等待思源笔记服务器响应确认后再刷新
                console.log('等待思源笔记服务器确认文档创建操作...');
                await this.waitForSiYuanResponse('创建文档');
                
                try {
                    console.log('开始刷新文档树...');
                    
                    // 先刷新文档列表
                    await this.refreshDocumentLists();
                    
                    // 再保存历史数据
                    await this.saveHistoryData();
                    
                    console.log('文档树刷新完成');
                    console.log('=== 请检查表2中是否显示了新创建的笔记 ===');
                } catch (refreshError) {
                    console.warn('刷新失败，但文档已创建:', refreshError);
                    showMessage('文档创建成功，请手动刷新页面查看');
                }
            } else {
                showMessage(`创建笔记失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('创建笔记失败:', error);
            showMessage('创建笔记失败: 网络错误');
        }
    }

    private async addSubDocumentToLevel3(notebookId: string, parentPath: string, parentDocId: string, itemName?: string) {
        console.log('=== 用户点击了"添加子文档"菜单 ===');
        console.log('用户选中的item信息:', {
            选中的文档名称: itemName || '未知',
            选中的文档ID: parentDocId,
            选中的文档路径: parentPath,
            所属笔记本ID: notebookId
        });
        console.log('用户实际选中的文档:', itemName || '未知名称');
        
        // 获取选中文档的详细信息
        let parentDocTitle = itemName || '未知';
        try {
            const docInfoResponse = await fetch('/api/block/getBlockInfo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: parentDocId
                })
            });
            const docInfo = await docInfoResponse.json();
            if (docInfo.code === 0) {
                parentDocTitle = docInfo.data.content || parentDocTitle;
                console.log('选中文档的详细信息:', {
                    文档标题: docInfo.data.content,
                    文档路径: docInfo.data.path,
                    文档ID: docInfo.data.id
                });
            }
        } catch (error) {
            console.log('获取文档详细信息失败:', error);
        }
        
        // 显示输入弹窗让用户输入子文档名称
        const docName = await this.showInputDialog("添加子文档", "请输入子文档名称:", "");
        if (!docName || docName.trim() === "") {
            console.log('用户取消了子文档创建');
            return;
        }
        console.log('用户输入的子文档名称:', docName.trim());

        // 输出当前选中item的节点信息
        console.log('\n=== 当前选中item的节点信息 ===');
        console.log('节点基本信息:', {
            节点名称: itemName || '未知',
            父文档实际标题: parentDocTitle,
            节点ID: parentDocId,
            节点路径: parentPath,
            所属笔记本: notebookId,
            节点类型: '文档节点'
        });
        
        // 输出准备根据哪些信息来创建子文档
        console.log('\n=== 准备创建子文档的依据信息 ===');
        console.log('将使用以下节点信息创建子文档:');
        console.log('1. 父文档标题:', parentDocTitle, '(父文档的实际名称)');
        console.log('2. 父文档ID:', parentDocId, '(作为新子文档的父级标识)');
        console.log('3. 父文档路径:', parentPath, '(用于构建子文档的完整路径)');
        console.log('4. 笔记本ID:', notebookId, '(指定子文档所属的笔记本)');
        console.log('5. 用户输入的子文档名称:', docName.trim(), '(作为新子文档的名称)');
        console.log('6. 子文档创建策略: 在父文档路径基础上添加子路径');

        try {
            console.log('\n=== 开始创建子文档 ===');
            console.log('父文档信息:', {
                parentDocId: parentDocId,
                parentPath: parentPath,
                notebookId: notebookId,
                子文档名称: docName.trim()
            });
            console.log('创建子文档参数:', { notebookId, parentPath, parentDocId, docName });
            
            // 参考Python代码的正确方式创建子文档
            console.log('使用正确的方式创建子文档');
            
            // 第一步：获取父文档的详细信息
            const getDocResponse = await fetch('/api/filetree/getDoc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: parentDocId
                })
            });
            
            const parentDocInfo = await getDocResponse.json();
            console.log('父文档详细信息:', parentDocInfo);
            
            if (parentDocInfo.code !== 0) {
                console.error('获取父文档信息失败:', parentDocInfo.msg);
                showMessage('获取父文档信息失败');
                return;
            }
            
            const parentInfo = parentDocInfo.data;
            const parentDocPath = parentInfo.path;
            
            // 第二步：生成新文档ID（模拟Python中的gen_id函数）
            const now = new Date();
            const pad = (num: number) => num < 10 ? '0' + num : num.toString();
            const timestamp = now.getFullYear().toString() + 
                            pad(now.getMonth() + 1) + 
                            pad(now.getDate()) + 
                            pad(now.getHours()) + 
                            pad(now.getMinutes()) + 
                            pad(now.getSeconds());
            const randomStr = Math.random().toString(36).substring(2, 9);
            const newDocId = `${timestamp}-${randomStr}`;
            
            // 第三步：构建子文档路径
            const parentBasePath = parentDocPath.replace(/\.sy$/, '');
            const newDocPath = `${parentBasePath}/${newDocId}.sy`;
            
            console.log('创建子文档信息:', {
                父文档路径: parentDocPath,
                父文档基础路径: parentBasePath,
                新文档ID: newDocId,
                新文档路径: newDocPath,
                新文档标题: docName.trim()
            });
            
            // 第四步：使用createDoc API创建子文档
            const response = await fetch('/api/filetree/createDoc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    title: docName.trim(),
                    path: newDocPath,
                    md: `# ${docName.trim()}\n\n这是一个新创建的子文档。`
                })
            });
            
            const result = await response.json();
            console.log('创建子文档API响应:', result);
            
            if (result.code === 0) {
                console.log('=== 子文档创建成功验证 ===');
                console.log('API返回结果:', result);
                console.log('预期父文档路径:', parentPath);
                console.log('预期父文档ID:', parentDocId);
                console.log('创建的子文档名称:', docName.trim());
                console.log('新创建的子文档ID:', result.data);
                console.log('子文档应该出现在表3中，父级为:', parentPath);
                
                showMessage(`子文档 "${docName}" 创建成功`);
                
                // 等待思源笔记服务器响应确认后再刷新
                console.log('等待思源笔记服务器确认子文档创建操作...');
                await this.waitForSiYuanResponse('创建子文档');
                
                // 刷新表3，专门针对新创建的子文档
                await this.refreshLevel3AfterSubDocCreation(parentPath, parentDocId);
                
                // 保存历史数据
                try {
                    await this.saveHistoryData();
                    console.log('历史数据保存完成');
                } catch (error) {
                    console.warn('保存历史数据失败:', error);
                }
            } else {
                console.error('创建子文档失败:', result);
                showMessage(`创建子文档失败: ${result.msg || '未知错误'}`);
            }
        } catch (error) {
            console.error('创建子文档详细错误:', { error, parentPath, docName });
            showMessage('创建子文档失败: 网络错误');
        }
    }

    private async createNoteInCurrentDir(currentPath: string) {
        // 显示输入弹窗
        const noteName = await this.showInputDialog("创建笔记", "请输入笔记名称:", "");
        if (!noteName || noteName.trim() === "") {
            return;
        }

        try {
            // 获取当前笔记本ID（从路径中解析或从当前状态获取）
            const notebookId = this.getCurrentNotebookId();
            if (!notebookId) {
                showMessage('无法获取当前笔记本信息');
                return;
            }

            // 构建文档路径
            const docPath = currentPath === '/' ? `/${noteName.trim()}` : `${currentPath}/${noteName.trim()}`;
            
            const response = await fetch('/api/filetree/createDocWithMd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    path: docPath,
                    markdown: `# ${noteName.trim()}\n\n`
                })
            });

            const result = await response.json();
            if (result.code === 0) {
                showMessage(`笔记 "${noteName}" 创建成功`);
                
                // 等待思源笔记服务器响应确认后再刷新
                console.log('等待思源笔记服务器确认笔记创建操作...');
                await this.waitForSiYuanResponse('创建笔记');
                
                // 刷新表3，专门针对新创建的笔记
                await this.refreshLevel3AfterNoteCreation(currentPath);
                
                // 保存历史数据
                try {
                    await this.saveHistoryData();
                    console.log('历史数据保存完成');
                } catch (error) {
                    console.warn('保存历史数据失败:', error);
                }
            } else {
                showMessage(`创建笔记失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('创建笔记失败:', error);
            showMessage('创建笔记失败: 网络错误');
        }
    }

    private async deleteDocument(docId: string, container: HTMLElement, items: any[], onItemClick: (item: any) => void) {
        const confirmed = await this.showConfirmDialog("确认删除", "确定要删除这个文档吗？此操作不可撤销。");
        if (!confirmed) {
            return;
        }

        try {
            // 获取当前笔记本ID
            const notebookId = this.getCurrentNotebookId();
            if (!notebookId) {
                showMessage('无法获取当前笔记本信息');
                return;
            }

            // 从items中找到对应的文档路径
            const docItem = items.find(item => item.id === docId);
            if (!docItem) {
                showMessage('无法找到文档信息');
                return;
            }

            const response = await fetch('/api/filetree/removeDoc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    path: docItem.path
                })
            });

            const result = await response.json();
            if (result.code === 0) {
                showMessage('文档删除成功');
                
                // 等待思源笔记服务器响应确认后再刷新
                console.log('等待思源笔记服务器确认文档删除操作...');
                await this.waitForSiYuanResponse('删除文档');
                
                try {
                    console.log('开始刷新文档树...');
                    
                    // 先刷新文档列表
                    await this.refreshDocumentLists();
                    
                    // 再保存历史数据
                    await this.saveHistoryData();
                    
                    console.log('文档树刷新完成');
                    console.log('=== 文档删除后刷新完成 ===');
                } catch (refreshError) {
                    console.warn('刷新失败，但文档已删除:', refreshError);
                    showMessage('文档删除成功，请手动刷新页面查看');
                }
            } else {
                showMessage(`删除文档失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('删除文档失败:', error);
            showMessage('删除文档失败: 网络错误');
        }
    }

    // 辅助方法：显示输入弹窗
    private async showInputDialog(title: string, message: string, defaultValue: string): Promise<string | null> {
        return new Promise((resolve) => {
            const dialog = new Dialog({
                title: title,
                content: `<div class="b3-dialog__content" style="background: #1a1a1a; color: #ffffff; padding: 16px;">
                    <div style="margin-bottom: 16px; font-size: 16px;">${message}</div>
                    <input type="text" id="input-dialog-text" value="${defaultValue}" style="width: 100%; padding: 8px; background: #2d2d2d; color: #fff; border: 1px solid #555; border-radius: 4px; font-size: 16px;">
                </div>
                <div class="b3-dialog__action" style="background: #1a1a1a; border-top: 1px solid #444;">
                    <button class="b3-button b3-button--cancel" style="background: #444; color: #fff; border: 1px solid #666; margin-right: 8px;">取消</button>
                    <button class="b3-button b3-button--text" style="background: #4285f4; color: #fff; border: 1px solid #4285f4;">确定</button>
                </div>`,
                width: this.isMobile ? "90vw" : "400px",
                height: "200px"
            });

            const input = dialog.element.querySelector("#input-dialog-text") as HTMLInputElement;
            const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
            const confirmBtn = dialog.element.querySelector(".b3-button--text") as HTMLButtonElement;

            input.focus();
            input.select();

            const handleConfirm = () => {
                const value = input.value.trim();
                dialog.destroy();
                resolve(value || null);
            };

            const handleCancel = () => {
                dialog.destroy();
                resolve(null);
            };

            confirmBtn.addEventListener("click", handleConfirm);
            cancelBtn.addEventListener("click", handleCancel);
            
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    handleConfirm();
                } else if (e.key === "Escape") {
                    handleCancel();
                }
            });
        });
    }

    // 辅助方法：显示确认弹窗
    private async showConfirmDialog(title: string, message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const dialog = new Dialog({
                title: title,
                content: `<div class="b3-dialog__content" style="background: #1a1a1a; color: #ffffff; padding: 16px;">
                    <div style="font-size: 16px; line-height: 1.5;">${message}</div>
                </div>
                <div class="b3-dialog__action" style="background: #1a1a1a; border-top: 1px solid #444;">
                    <button class="b3-button b3-button--cancel" style="background: #444; color: #fff; border: 1px solid #666; margin-right: 8px;">取消</button>
                    <button class="b3-button b3-button--text" style="background: #d73a49; color: #fff; border: 1px solid #d73a49;">确定</button>
                </div>`,
                width: this.isMobile ? "90vw" : "400px",
                height: "180px"
            });

            const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
            const confirmBtn = dialog.element.querySelector(".b3-button--text") as HTMLButtonElement;

            confirmBtn.addEventListener("click", () => {
                dialog.destroy();
                resolve(true);
            });

            cancelBtn.addEventListener("click", () => {
                dialog.destroy();
                resolve(false);
            });
        });
    }

    // 辅助方法：获取当前笔记本ID
    private getCurrentNotebookId(): string | null {
        // 从当前状态或DOM中获取笔记本ID
        const selectedNotebook = document.querySelector('.tree-item.selected[data-type="notebook"]');
        if (selectedNotebook) {
            return selectedNotebook.getAttribute('data-id');
        }
        
        // 如果没有选中的笔记本，尝试从保存的状态中获取
        return this.currentNotebookId || null;
    }

    private getCurrentLevel2DocPath(): string {
        return this.currentLevel2DocPath;
    }

    // 获取并输出文档树
    private async getAndLogDocumentTree() {
        try {
            console.log('开始获取文档树...');
            
            // 首先获取所有笔记本
            const notebooksResponse = await fetch('/api/notebook/lsNotebooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const notebooksData = await notebooksResponse.json();
            
            if (notebooksData && notebooksData.code === 0 && notebooksData.data) {
                const documentTree = {
                    notebooks: []
                };
                
                // 遍历每个笔记本，获取其文档树
                for (const notebook of notebooksData.data.notebooks) {
                    console.log(`正在获取笔记本 "${notebook.name}" 的文档树...`);
                    
                    const notebookTree = {
                        id: notebook.id,
                        name: notebook.name,
                        icon: notebook.icon,
                        documents: await this.getDocumentTreeForNotebook(notebook.id)
                    };
                    
                    documentTree.notebooks.push(notebookTree);
                }
                
                console.log('完整文档树结构:', documentTree);
                console.log('文档树获取完成！');
                
                // 显示成功消息
                showMessage('文档树已输出到控制台，请按F12查看', 3000);
            } else {
                console.error('获取笔记本列表失败:', notebooksData);
                showMessage('获取笔记本列表失败', 3000);
            }
        } catch (error) {
            console.error('获取文档树时发生错误:', error);
            showMessage('获取文档树失败', 3000);
        }
    }
    
    // 递归获取指定笔记本的文档树
    private async getDocumentTreeForNotebook(notebookId: string, path: string = '/'): Promise<any[]> {
        try {
            const response = await fetch('/api/filetree/listDocsByPath', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    path: path,
                    maxListCount: 99999
                })
            });
            
            const data = await response.json();
            
            if (data && data.code === 0 && data.data && data.data.files) {
                const documents = [];
                
                for (const file of data.data.files) {
                    const doc = {
                        id: file.id,
                        name: file.name,
                        path: file.path,
                        type: file.type,
                        subFileCount: file.subFileCount || 0,
                        children: []
                    };
                    
                    // 如果有子文档，递归获取
                    if (file.subFileCount > 0) {
                        doc.children = await this.getDocumentTreeForNotebook(notebookId, file.path);
                    }
                    
                    documents.push(doc);
                }
                
                return documents;
            } else {
                return [];
            }
        } catch (error) {
            console.error(`获取路径 ${path} 的文档时发生错误:`, error);
            return [];
        }
    }

    // 辅助方法：刷新笔记本列表
    private async refreshNotebookList() {
        const container = document.querySelector('#dock-tree-level-1') as HTMLElement;
        if (container) {
            await this.loadNotebooksForDock(container, this.currentNotebooks, this.onNotebookClick);
        }
    }

    // 辅助方法：刷新文档列表
    private async refreshDocumentLists() {
        // 刷新表2
        const level2Container = document.querySelector('#dock-tree-level-2') as HTMLElement;
        const level3Container = document.querySelector('#dock-tree-level-3') as HTMLElement;
        
        if (level2Container && this.getCurrentNotebookId()) {
            // 确保传递正确的参数
            this.currentLevel2Docs = this.currentLevel2Docs || [];
            this.currentLevel3Docs = this.currentLevel3Docs || [];
            await this.loadDocumentsForDock(
                this.getCurrentNotebookId(),
                level2Container,
                level3Container,
                this.currentLevel2Docs,
                this.currentLevel3Docs,
                this.onLevel2DocClick
            );
        }
        
        // 刷新表3
        if (level3Container && this.currentLevel3Docs && this.getCurrentNotebookId()) {
            // 获取当前选中的level2文档路径作为parentPath
            const currentLevel2DocPath = this.getCurrentLevel2DocPath();
            if (currentLevel2DocPath) {
                await this.loadSubDocumentsForDock(
                    this.getCurrentNotebookId(),
                    currentLevel2DocPath,
                    level3Container,
                    this.currentLevel3Docs,
                    this.onLevel3DocClick
                );
            }
        }
    }

    // 专门用于子文档创建后刷新表3的方法
    private async refreshLevel3AfterSubDocCreation(parentPath: string, parentDocId: string) {
        console.log('开始专门刷新表3，父文档路径:', parentPath);
        
        // 多次尝试刷新，确保成功
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                // 等待一小段时间让 SiYuan 处理
                await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
                
                const level3Container = document.querySelector('#dock-tree-level-3') as HTMLElement;
                const notebookId = this.getCurrentNotebookId();
                
                if (level3Container && notebookId) {
                    console.log(`第${i + 1}次尝试刷新表3...`);
                    
                    // 强制重新加载子文档
                    await this.loadSubDocumentsForDock(
                        notebookId,
                        parentPath,
                        level3Container,
                        this.currentLevel3Docs,
                        this.onLevel3DocClick
                    );
                    
                    console.log(`第${i + 1}次刷新完成`);
                    
                    // 检查是否有子文档显示
                    const items = level3Container.querySelectorAll('.tree-item');
                    if (items.length > 0) {
                        console.log(`表3刷新成功，显示了 ${items.length} 个子文档`);
                        break;
                    } else {
                        console.log(`第${i + 1}次刷新后表3仍为空，继续尝试...`);
                    }
                } else {
                    console.warn('找不到表3容器或笔记本ID');
                }
            } catch (error) {
                console.error(`第${i + 1}次刷新表3失败:`, error);
            }
        }
        
        console.log('表3刷新完成，请检查是否显示了新创建的子文档');
    }

    // 等待思源笔记服务器响应的方法
    private async waitForSiYuanResponse(operation: string, maxWaitTime: number = 3000): Promise<boolean> {
        console.log(`等待思源笔记服务器响应: ${operation}`);
        
        const startTime = Date.now();
        const checkInterval = 100; // 每100ms检查一次
        
        return new Promise((resolve) => {
            const checkResponse = async () => {
                const elapsed = Date.now() - startTime;
                
                if (elapsed >= maxWaitTime) {
                    console.log(`等待超时 (${maxWaitTime}ms)，继续执行刷新`);
                    resolve(true);
                    return;
                }
                
                try {
                    // 通过查询思源笔记的系统状态来判断是否处理完毕
                    const response = await fetch('/api/system/getConf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        if (result.code === 0) {
                            console.log(`思源笔记服务器响应正常，操作 ${operation} 已完成`);
                            resolve(true);
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('检查服务器响应时出错:', error);
                }
                
                // 继续等待
                setTimeout(checkResponse, checkInterval);
            };
            
            // 开始检查
            setTimeout(checkResponse, checkInterval);
        });
    }

    // 专门用于在表3中创建笔记后刷新的方法
    // 恢复Dock滚动位置和选中状态的方法
    private restoreScrollPositions(level1Container: HTMLElement, level2Container: HTMLElement, level3Container: HTMLElement, scrollPositions?: any) {
        if (!scrollPositions) {
            console.log('没有保存的滚动位置信息');
            return;
        }
        
        try {
            console.log('开始恢复滚动位置:', scrollPositions);
            
            if (scrollPositions.level1 && level1Container) {
                level1Container.scrollTop = scrollPositions.level1;
                console.log(`恢复表1滚动位置: ${scrollPositions.level1}, 实际滚动位置: ${level1Container.scrollTop}`);
            }
            
            if (scrollPositions.level2 && level2Container) {
                level2Container.scrollTop = scrollPositions.level2;
                console.log(`恢复表2滚动位置: ${scrollPositions.level2}, 实际滚动位置: ${level2Container.scrollTop}`);
            }
            
            if (scrollPositions.level3 && level3Container) {
                level3Container.scrollTop = scrollPositions.level3;
                console.log(`恢复表3滚动位置: ${scrollPositions.level3}, 实际滚动位置: ${level3Container.scrollTop}`);
            }
            
            console.log('滚动位置恢复完成');
        } catch (error) {
            console.warn('恢复滚动位置时出错:', error);
        }
    }

    // 恢复选中项状态的方法
    private async restoreSelectedItems(level1Container: HTMLElement, level2Container: HTMLElement, level3Container: HTMLElement, selectedItems?: any) {
        if (!selectedItems) {
            console.log('没有保存的选中项信息');
            return;
        }
        
        try {
            console.log('开始按顺序恢复选中项状态:', selectedItems);
            console.log('当前可用的笔记本数据:', this.currentNotebooks);
            
            // 第一步：恢复表1选中状态（笔记本）并触发点击
            if (selectedItems.notebookId && level1Container) {
                const notebookElements = level1Container.querySelectorAll('.tree-item');
                console.log(`找到 ${notebookElements.length} 个笔记本DOM元素`);
                let notebookFound = false;
                
                for (const element of notebookElements) {
                    const itemId = element.getAttribute('data-id');
                    if (itemId === selectedItems.notebookId) {
                        // 找到对应的笔记本数据
                        const notebook = this.currentNotebooks.find(nb => nb.id === selectedItems.notebookId);
                        if (notebook) {
                            console.log(`恢复表1选中项并触发点击: ${selectedItems.notebookId}`, notebook);
                            // 触发点击事件加载表2数据
                            this.onNotebookClick(notebook);
                            notebookFound = true;
                            
                            // 等待表2数据加载完成
                            await new Promise(resolve => setTimeout(resolve, 300));
                            break;
                        } else {
                            console.warn(`找到DOM元素但未找到笔记本数据: ${selectedItems.notebookId}`);
                        }
                    }
                }
                
                if (!notebookFound) {
                    console.warn('未找到要恢复的笔记本:', selectedItems.notebookId);
                    console.log('所有可用的笔记本ID:', this.currentNotebooks.map(nb => nb.id));
                    return;
                }
            }
            
            // 第二步：恢复表2选中状态（二级文档）并触发点击
            if (selectedItems.level2DocPath && level2Container) {
                // 等待表2 DOM更新，增加等待时间
                await new Promise(resolve => setTimeout(resolve, 600));
                
                const docElements = level2Container.querySelectorAll('.tree-item');
                console.log(`找到 ${docElements.length} 个二级文档DOM元素`);
                console.log('当前可用的二级文档数据:', this.currentLevel2Docs);
                let docFound = false;
                
                for (const element of docElements) {
                    const itemPath = element.getAttribute('data-path');
                    if (itemPath === selectedItems.level2DocPath) {
                        // 找到对应的文档数据
                        const doc = this.currentLevel2Docs.find(d => d.path === selectedItems.level2DocPath);
                        if (doc) {
                            console.log(`恢复表2选中项并触发点击: ${selectedItems.level2DocPath}`, doc);
                            // 触发点击事件加载表3数据
                            this.onLevel2DocClick(doc);
                            docFound = true;
                            
                            // 等待表3数据加载完成
                            await new Promise(resolve => setTimeout(resolve, 600));
                            break;
                        } else {
                            console.warn(`找到DOM元素但未找到二级文档数据: ${selectedItems.level2DocPath}`);
                        }
                    }
                }
                
                if (!docFound) {
                    console.warn('未找到要恢复的二级文档:', selectedItems.level2DocPath);
                    console.log('所有可用的二级文档路径:', this.currentLevel2Docs.map(d => d.path));
                }
            }
            
            // 第三步：恢复表3选中状态（三级文档）并触发点击
            if (selectedItems.level3DocPath && level3Container) {
                // 等待表3 DOM更新，增加等待时间
                await new Promise(resolve => setTimeout(resolve, 400));
                
                const docElements = level3Container.querySelectorAll('.tree-item');
                console.log(`找到 ${docElements.length} 个三级文档DOM元素`);
                console.log('当前可用的三级文档数据:', this.currentLevel3Docs);
                let docFound = false;
                
                for (const element of docElements) {
                    const itemPath = element.getAttribute('data-path');
                    if (itemPath === selectedItems.level3DocPath) {
                        // 找到对应的文档数据
                        const doc = this.currentLevel3Docs.find(d => d.path === selectedItems.level3DocPath);
                        if (doc) {
                            console.log(`恢复表3选中项并触发点击: ${selectedItems.level3DocPath}`, doc);
                            // 触发点击事件
                            this.onLevel3DocClick(doc);
                            docFound = true;
                            break;
                        } else {
                            console.warn(`找到DOM元素但未找到三级文档数据: ${selectedItems.level3DocPath}`);
                        }
                    }
                }
                
                if (!docFound) {
                    console.warn('未找到要恢复的三级文档:', selectedItems.level3DocPath);
                    console.log('所有可用的三级文档路径:', this.currentLevel3Docs.map(d => d.path));
                }
            }
            
            console.log('选中项状态恢复完成，即将恢复滚动位置');
        } catch (error) {
            console.warn('恢复选中项状态时出错:', error);
        }
    }

    // 恢复对话框滚动位置的方法
    private restoreDialogScrollPositions(level1Container: HTMLElement, level2Container: HTMLElement, level3Container: HTMLElement, level4Container: HTMLElement, scrollPositions?: any) {
        if (!scrollPositions) {
            console.log('没有保存的对话框滚动位置信息');
            return;
        }
        
        try {
            if (scrollPositions.level1 && level1Container) {
                level1Container.scrollTop = scrollPositions.level1;
                console.log(`恢复对话框表1滚动位置: ${scrollPositions.level1}`);
            }
            
            if (scrollPositions.level2 && level2Container) {
                level2Container.scrollTop = scrollPositions.level2;
                console.log(`恢复对话框表2滚动位置: ${scrollPositions.level2}`);
            }
            
            if (scrollPositions.level3 && level3Container) {
                level3Container.scrollTop = scrollPositions.level3;
                console.log(`恢复对话框表3滚动位置: ${scrollPositions.level3}`);
            }
            
            if (scrollPositions.level4 && level4Container) {
                level4Container.scrollTop = scrollPositions.level4;
                console.log(`恢复对话框表4滚动位置: ${scrollPositions.level4}`);
            }
            
            console.log('对话框滚动位置恢复完成');
        } catch (error) {
            console.warn('恢复对话框滚动位置时出错:', error);
        }
    }

    // 恢复对话框选中项状态的方法
    private async restoreDialogSelectedItems(level1Container: HTMLElement, level2Container: HTMLElement, level3Container: HTMLElement, level4Container: HTMLElement, selectedItems?: any) {
        if (!selectedItems) {
            console.log('没有保存的对话框选中项信息');
            return;
        }
        
        try {
            console.log('开始按顺序恢复对话框选中项状态:', selectedItems);
            
            // 第一步：恢复表1选中状态（笔记本）并触发点击
            if (selectedItems.notebookId && level1Container) {
                const notebookElements = level1Container.querySelectorAll('.tree-item');
                let notebookFound = false;
                
                for (const element of notebookElements) {
                    const itemId = element.getAttribute('data-id');
                    if (itemId === selectedItems.notebookId) {
                        // 找到对应的笔记本数据
                        const notebook = this.currentNotebooks.find(nb => nb.id === selectedItems.notebookId);
                        if (notebook) {
                            console.log(`恢复对话框表1选中项并触发点击: ${selectedItems.notebookId}`);
                            // 模拟点击事件
                            (element as HTMLElement).click();
                            notebookFound = true;
                            
                            // 等待表2数据加载完成
                            await new Promise(resolve => setTimeout(resolve, 300));
                            break;
                        }
                    }
                }
                
                if (!notebookFound) {
                    console.warn('未找到要恢复的对话框笔记本:', selectedItems.notebookId);
                    return;
                }
            }
            
            // 第二步：恢复表2选中状态（二级文档）并触发点击
            if (selectedItems.level2DocPath && level2Container) {
                // 等待表2 DOM更新
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const docElements = level2Container.querySelectorAll('.tree-item');
                let docFound = false;
                
                for (const element of docElements) {
                    const itemPath = element.getAttribute('data-path');
                    if (itemPath === selectedItems.level2DocPath) {
                        console.log(`恢复对话框表2选中项并触发点击: ${selectedItems.level2DocPath}`);
                        // 模拟点击事件
                        (element as HTMLElement).click();
                        docFound = true;
                        
                        // 等待表3数据加载完成
                        await new Promise(resolve => setTimeout(resolve, 300));
                        break;
                    }
                }
                
                if (!docFound) {
                    console.warn('未找到要恢复的对话框二级文档:', selectedItems.level2DocPath);
                }
            }
            
            // 第三步：恢复表3选中状态（三级文档）并触发点击
            if (selectedItems.level3DocPath && level3Container) {
                // 等待表3 DOM更新
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const docElements = level3Container.querySelectorAll('.tree-item');
                let docFound = false;
                
                for (const element of docElements) {
                    const itemPath = element.getAttribute('data-path');
                    if (itemPath === selectedItems.level3DocPath) {
                        console.log(`恢复对话框表3选中项并触发点击: ${selectedItems.level3DocPath}`);
                        // 模拟点击事件
                        (element as HTMLElement).click();
                        docFound = true;
                        
                        // 等待表4数据加载完成
                        await new Promise(resolve => setTimeout(resolve, 300));
                        break;
                    }
                }
                
                if (!docFound) {
                    console.warn('未找到要恢复的对话框三级文档:', selectedItems.level3DocPath);
                }
            }
            
            // 第四步：恢复表4选中状态（四级文档）并触发点击
            if (selectedItems.level4DocPath && level4Container) {
                // 等待表4 DOM更新
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const docElements = level4Container.querySelectorAll('.tree-item');
                let docFound = false;
                
                for (const element of docElements) {
                    const itemPath = element.getAttribute('data-path');
                    if (itemPath === selectedItems.level4DocPath) {
                        console.log(`恢复对话框表4选中项并触发点击: ${selectedItems.level4DocPath}`);
                        // 模拟点击事件
                        (element as HTMLElement).click();
                        docFound = true;
                        break;
                    }
                }
                
                if (!docFound) {
                    console.warn('未找到要恢复的对话框四级文档:', selectedItems.level4DocPath);
                }
            }
            
            console.log('对话框选中项状态恢复完成');
        } catch (error) {
            console.warn('恢复对话框选中项状态时出错:', error);
        }
    }

    private async refreshLevel3AfterNoteCreation(currentPath: string) {
        console.log('开始专门刷新表3，当前路径:', currentPath);
        
        // 多次尝试刷新，确保成功
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                // 等待一小段时间让 SiYuan 处理
                await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
                
                const level3Container = document.querySelector('#dock-tree-level-3') as HTMLElement;
                const notebookId = this.getCurrentNotebookId();
                
                if (level3Container && notebookId) {
                    console.log(`第${i + 1}次尝试刷新表3...`);
                    
                    // 强制重新加载子文档
                    // 从currentPath推导出父路径
                    const parentPath = this.getCurrentLevel2DocPath();
                    if (parentPath) {
                        await this.loadSubDocumentsForDock(
                            notebookId,
                            parentPath,
                            level3Container,
                            this.currentLevel3Docs,
                            this.onLevel3DocClick
                        );
                        
                        console.log(`第${i + 1}次刷新完成`);
                        
                        // 检查是否有文档显示
                        const items = level3Container.querySelectorAll('.tree-item');
                        if (items.length > 0) {
                            console.log(`表3刷新成功，显示了 ${items.length} 个文档`);
                            break;
                        } else {
                            console.log(`第${i + 1}次刷新后表3仍为空，继续尝试...`);
                        }
                    } else {
                        console.warn('无法获取父文档路径');
                    }
                } else {
                    console.warn('找不到表3容器或笔记本ID');
                }
            } catch (error) {
                console.error(`第${i + 1}次刷新表3失败:`, error);
            }
        }
        
        console.log('表3刷新完成，请检查是否显示了新创建的笔记');
    }

    private async refreshAllDocumentTrees() {
        // 全局刷新：重新加载笔记本列表和所有文档列表
        await this.refreshNotebookList();
        await this.refreshDocumentLists();
    }

    // 统一的刷新和状态恢复函数：用于右键菜单执行后的完整刷新
    private async refreshDocumentTreesWithStateRestore() {
        try {
            console.log('开始执行统一刷新和状态恢复...');
            
            // 1. 获取当前状态（在刷新前保存）
            const level1Container = document.querySelector('#dock-tree-level-1') as HTMLElement;
            const level2Container = document.querySelector('#dock-tree-level-2') as HTMLElement;
            const level3Container = document.querySelector('#dock-tree-level-3') as HTMLElement;
            
            let currentState: any = null;
            if (level1Container && level2Container && level3Container) {
                // 保存当前状态
                currentState = {
                    selectedItems: {
                        notebookId: this.getCurrentNotebookId(),
                        level2DocPath: this.getCurrentLevel2DocPath(),
                        level3DocPath: this.getCurrentLevel3DocPath()
                    },
                    scrollPositions: {
                        level1: level1Container.scrollTop,
                        level2: level2Container.scrollTop,
                        level3: level3Container.scrollTop
                    }
                };
                console.log('保存的当前状态:', currentState);
            }
            
            // 2. 重新从文档树中获取文档结构
            console.log('开始重新获取文档结构...');
            await this.refreshAllDocumentTrees();
            console.log('文档结构获取完成');
            
            // 3. 恢复最后状态
            if (currentState && level1Container && level2Container && level3Container) {
                console.log('开始恢复状态...');
                
                // 延迟执行状态恢复，确保DOM已更新
                setTimeout(async () => {
                    try {
                        // 恢复选中项状态（这会触发相应的数据加载）
                        await this.restoreSelectedItems(level1Container, level2Container, level3Container, currentState.selectedItems);
                        
                        // 再次延迟恢复滚动位置，确保数据加载完成
                        setTimeout(() => {
                            this.restoreScrollPositions(level1Container, level2Container, level3Container, currentState.scrollPositions);
                            console.log('状态恢复完成');
                        }, 300);
                    } catch (restoreError) {
                        console.warn('状态恢复过程中出错:', restoreError);
                    }
                }, 500);
            }
            
            console.log('统一刷新和状态恢复执行完成');
        } catch (error) {
            console.error('统一刷新和状态恢复过程中出错:', error);
            // 如果出错，至少执行基本刷新
            try {
                await this.refreshAllDocumentTrees();
            } catch (fallbackError) {
                console.error('备用刷新也失败:', fallbackError);
            }
        }
    }

    // 辅助方法：保存历史数据
    private async saveHistoryData() {
        try {
            const historyData = {
                timestamp: Date.now(),
                currentNotebookId: this.getCurrentNotebookId(),
                notebooks: this.currentNotebooks || [],
                level2Docs: this.currentLevel2Docs || [],
                level3Docs: this.currentLevel3Docs || [],
                level4Docs: this.currentLevel4Docs || []
            };
            
            await this.saveData('file-tree-history', historyData);
            console.log('历史数据已保存:', historyData);
        } catch (error) {
            console.error('保存历史数据失败:', error);
        }
    }

    // 添加类属性来存储当前数据
    private currentNotebookId: string = '';
    private currentNotebooks: any[] = [];
    private currentLevel2Docs: any[] = [];
    private currentLevel3Docs: any[] = [];
    private currentLevel4Docs: any[] = [];
    private currentLevel2DocPath: string = '';
    private onNotebookClick: (item: any) => void = () => {};
    private onLevel2DocClick: (item: any) => void = () => {};
    private onLevel3DocClick: (item: any) => void = () => {};

    private async showFileTreeDialog() {
        const dialog = new Dialog({
            title: "文档目录",
            content: `<div class="b3-dialog__content" style="background: #1a1a1a; color: #ffffff; padding: 16px;">
    <div style="display: flex; height: 500px; gap: 12px;">
        <div class="file-tree-column" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d;">
            <div style="padding: 8px; border-bottom: 1px solid #444; background: #333;">
                <input type="text" id="search-level-1" placeholder="搜索笔记本..." style="width: 100%; padding: 4px; background: #2d2d2d; color: #fff; border: 1px solid #555; border-radius: 2px;">
            </div>
            <div id="tree-level-1" class="tree-list" style="height: calc(100% - 40px); overflow-y: auto; padding: 8px;"></div>
        </div>
        <div class="file-tree-column" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d;">
            <div style="padding: 8px; border-bottom: 1px solid #444; background: #333;">
                <input type="text" id="search-level-2" placeholder="搜索文档..." style="width: 100%; padding: 4px; background: #2d2d2d; color: #fff; border: 1px solid #555; border-radius: 2px;">
            </div>
            <div id="tree-level-2" class="tree-list" style="height: calc(100% - 40px); overflow-y: auto; padding: 8px;"></div>
        </div>
        <div class="file-tree-column" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d;">
            <div style="padding: 8px; border-bottom: 1px solid #444; background: #333;">
                <input type="text" id="search-level-3" placeholder="搜索子文档..." style="width: 100%; padding: 4px; background: #2d2d2d; color: #fff; border: 1px solid #555; border-radius: 2px;">
            </div>
            <div id="tree-level-3" class="tree-list" style="height: calc(100% - 40px); overflow-y: auto; padding: 8px;"></div>
        </div>
        <div class="file-tree-column" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d;">
            <div style="padding: 8px; border-bottom: 1px solid #444; background: #333;">
                <input type="text" id="search-level-4" placeholder="搜索深层文档..." style="width: 100%; padding: 4px; background: #2d2d2d; color: #fff; border: 1px solid #555; border-radius: 2px;">
            </div>
            <div id="tree-level-4" class="tree-list" style="height: calc(100% - 40px); overflow-y: auto; padding: 8px;"></div>
        </div>
    </div>
</div>
<div class="b3-dialog__action" style="background: #1a1a1a; border-top: 1px solid #444;">
    <button class="b3-button b3-button--cancel" style="background: #444; color: #fff; border: 1px solid #666;">关闭</button>
</div>`,
            width: this.isMobile ? "92vw" : "1300px",
            height: "600px",
        });

        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        const level1Container = dialog.element.querySelector("#tree-level-1") as HTMLDivElement;
        const level2Container = dialog.element.querySelector("#tree-level-2") as HTMLDivElement;
        const level3Container = dialog.element.querySelector("#tree-level-3") as HTMLDivElement;
        const level4Container = dialog.element.querySelector("#tree-level-4") as HTMLDivElement;
        const search1 = dialog.element.querySelector("#search-level-1") as HTMLInputElement;
        const search2 = dialog.element.querySelector("#search-level-2") as HTMLInputElement;
        const search3 = dialog.element.querySelector("#search-level-3") as HTMLInputElement;
        const search4 = dialog.element.querySelector("#search-level-4") as HTMLInputElement;

        // 加载保存的状态
        const savedStatePromise = this.loadData(TREE_STATE_STORAGE);
        console.log('加载的保存状态:', savedStatePromise);
        const savedState = await savedStatePromise || {};
        console.log('解析后的保存状态:', savedState);
        this.currentNotebookId = savedState.currentNotebookId || '';
        let currentLevel2DocPath = savedState.currentLevel2DocPath || '';
        let currentLevel3DocPath = savedState.currentLevel3DocPath || '';
        let currentLevel4DocPath = savedState.currentLevel4DocPath || '';
        
        // 恢复保存的数据
        this.currentNotebooks = savedState.notebooks || [];
        this.currentLevel2Docs = savedState.level2Docs || [];
        this.currentLevel3Docs = savedState.level3Docs || [];
        this.currentLevel4Docs = savedState.level4Docs || [];
        
        console.log('当前状态变量:', {
            currentNotebookId: this.currentNotebookId,
            currentLevel2DocPath,
            currentLevel3DocPath,
            currentLevel4DocPath
        });

        // 保存状态的函数（包括滚动位置）
        const saveCurrentState = () => {
            const level1ScrollTop = level1Container.scrollTop || 0;
            const level2ScrollTop = level2Container.scrollTop || 0;
            const level3ScrollTop = level3Container.scrollTop || 0;
            const level4ScrollTop = level4Container.scrollTop || 0;
            
            this.saveData(TREE_STATE_STORAGE, {
                currentNotebookId: this.currentNotebookId,
                currentLevel2DocPath,
                currentLevel3DocPath,
                currentLevel4DocPath,
                notebooks: this.currentNotebooks,
                level2Docs: this.currentLevel2Docs,
                level3Docs: this.currentLevel3Docs,
                level4Docs: this.currentLevel4Docs,
                // 对话框的滚动位置记录
                dialogScrollPositions: {
                    level1: level1ScrollTop,
                    level2: level2ScrollTop,
                    level3: level3ScrollTop,
                    level4: level4ScrollTop
                },
                // 选中项记录
                selectedItems: {
                    notebookId: this.currentNotebookId,
                    level2DocPath: currentLevel2DocPath,
                    level3DocPath: currentLevel3DocPath,
                    level4DocPath: currentLevel4DocPath
                }
            });
            console.log('对话框状态已保存:', {
                currentNotebookId: this.currentNotebookId,
                currentLevel2DocPath,
                currentLevel3DocPath,
                currentLevel4DocPath,
                scrollPositions: {
                    level1: level1ScrollTop,
                    level2: level2ScrollTop,
                    level3: level3ScrollTop,
                    level4: level4ScrollTop
                }
            });
        };

        cancelBtn.addEventListener("click", () => {
            saveCurrentState();
            dialog.destroy();
        });
        
        // 在对话框销毁时也保存状态
        dialog.element.addEventListener('beforeunload', saveCurrentState);
        
        // 监听对话框关闭事件
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach((node) => {
                        if (node === dialog.element) {
                            saveCurrentState();
                        }
                    });
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 定义点击回调函数
        
        this.onNotebookClick = (notebook: any) => {
            console.log('选中笔记本:', notebook.name, notebook.id);
            this.currentNotebookId = notebook.id;
            const savedLevel2Path = (notebook.id === savedState.currentNotebookId) ? savedState.currentLevel2DocPath : undefined;
            this.loadDocuments(notebook.id, level2Container, level3Container, level4Container, this.currentLevel2Docs, this.currentLevel3Docs, this.currentLevel4Docs, this.onLevel2DocClick, savedLevel2Path);
        };
        
        this.onLevel2DocClick = (doc: any) => {
            this.currentLevel2DocPath = doc.path;
            if (doc.subFileCount > 0) {
                const savedLevel3Path = (doc.path === savedState.currentLevel2DocPath) ? savedState.currentLevel3DocPath : undefined;
                this.loadSubDocuments(this.currentNotebookId, doc.path, level3Container, level4Container, this.currentLevel3Docs, this.currentLevel4Docs, this.onLevel3DocClick, savedLevel3Path);
            } else {
                level3Container.innerHTML = '<div style="color: #888; padding: 8px; font-size: 14px;">无子文档</div>';
                level4Container.innerHTML = '';
                this.currentLevel3Docs.length = 0;
                this.currentLevel4Docs.length = 0;
                // 如果是最后一级文档，在新标签页中打开
                openTab({
                    app: this.app,
                    doc: {
                        id: doc.id,
                        action: [Constants.CB_GET_FOCUS]
                    }
                });
            }
        };
        
        this.onLevel3DocClick = (doc: any) => {
            console.log('选中第3级文档:', doc);
            this.currentLevel3DocPath = doc.path;
            if (doc.subFileCount > 0) {
                const savedLevel4Path = (doc.path === savedState.currentLevel3DocPath) ? savedState.currentLevel4DocPath : undefined;
                this.loadLevel4Documents(this.currentNotebookId, doc.path, level4Container, this.currentLevel4Docs, this.onLevel4DocClick, savedLevel4Path);
            } else {
                level4Container.innerHTML = '<div style="color: #888; padding: 8px; font-size: 14px;">无更深层文档</div>';
                this.currentLevel4Docs.length = 0;
                // 如果是最后一级文档，在新标签页中打开
                openTab({
                    app: this.app,
                    doc: {
                        id: doc.id,
                        action: [Constants.CB_GET_FOCUS]
                    }
                });
            }
        };
        
        this.onLevel4DocClick = (doc: any) => {
            console.log('选中第4级文档:', doc);
            this.currentLevel4DocPath = doc.path;
            // 第4级文档直接在新标签页中打开
            openTab({
                app: this.app,
                doc: {
                    id: doc.id,
                    action: [Constants.CB_GET_FOCUS]
                }
            });
        };

        // 搜索功能
        search1.addEventListener("input", () => {
            this.filterTreeItems(level1Container, search1.value, currentNotebooks, onNotebookClick);
        });

        search2.addEventListener("input", () => {
            this.filterTreeItems(level2Container, search2.value, this.currentLevel2Docs, this.onLevel2DocClick);
        });

        search3.addEventListener("input", () => {
            this.filterTreeItems(level3Container, search3.value, this.currentLevel3Docs, this.onLevel3DocClick);
        });

        search4.addEventListener("input", () => {
            this.filterTreeItems(level4Container, search4.value, this.currentLevel4Docs, this.onLevel4DocClick);
        });

        // 添加滚动事件监听器，实时保存滚动位置
        const throttle = (func: Function, delay: number) => {
            let timeoutId: number;
            return (...args: any[]) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(null, args), delay);
            };
        };

        const throttledSaveState = throttle(saveCurrentState, 300); // 300ms节流

        level1Container.addEventListener('scroll', throttledSaveState);
        level2Container.addEventListener('scroll', throttledSaveState);
        level3Container.addEventListener('scroll', throttledSaveState);
        level4Container.addEventListener('scroll', throttledSaveState);

        // 加载笔记本列表
         this.loadNotebooks(level1Container, level2Container, level3Container, level4Container, savedState);
         
         // 恢复对话框选中项状态（延迟执行，确保DOM已渲染）
         setTimeout(async () => {
             // 先恢复选中项，这会触发数据加载
             await this.restoreDialogSelectedItems(level1Container, level2Container, level3Container, level4Container, savedState.selectedItems);
             
             // 等待所有数据加载完成后再恢复滚动位置
             setTimeout(() => {
                 this.restoreDialogScrollPositions(level1Container, level2Container, level3Container, level4Container, savedState.dialogScrollPositions);
             }, 300);
         }, 800);
     }

     private async loadNotebooks(level1Container: HTMLDivElement, level2Container: HTMLDivElement, level3Container: HTMLDivElement, level4Container: HTMLDivElement, savedState: any) {
         try {
             const response = await fetch('/api/notebook/lsNotebooks', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({})
             });
             const data = await response.json();
             
             if (data.code === 0 && data.data && data.data.notebooks) {
                 this.currentNotebooks.length = 0;
                 this.currentNotebooks.push(...data.data.notebooks);
                 this.renderTreeItems(level1Container, this.currentNotebooks, this.onNotebookClick);
                 
                 // 恢复之前的状态
                 if (savedState.currentNotebookId) {
                     const savedNotebook = this.currentNotebooks.find(nb => nb.id === savedState.currentNotebookId);
                     if (savedNotebook) {
                         // 自动点击之前选中的笔记本
                         setTimeout(() => {
                             this.onNotebookClick(savedNotebook);
                             // 添加选中状态的视觉反馈
                             const notebookElements = level1Container.querySelectorAll('div');
                             notebookElements.forEach((el, index) => {
                                 if (index < this.currentNotebooks.length && this.currentNotebooks[index].id === savedState.currentNotebookId) {
                                     el.classList.add('selected');
                                 }
                             });
                         }, 100);
                     }
                 }
             }
         } catch (error) {
             console.error('加载笔记本失败:', error);
             level1Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">加载失败</div>';
         }
     }

     private async loadDocuments(notebookId: string, level2Container: HTMLDivElement, level3Container: HTMLDivElement, level4Container: HTMLDivElement, currentLevel2Docs: any[], currentLevel3Docs: any[], currentLevel4Docs: any[], onLevel2DocClick: (doc: any) => void, savedLevel2DocPath?: string) {
         console.log('开始加载文档，笔记本ID:', notebookId);
         try {
             const response = await fetch('/api/filetree/listDocsByPath', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     notebook: notebookId,
                     path: '/',
                     maxListCount: 99999  // 设置为大数值以绕过系统默认512限制
                 })
             });
             const data = await response.json();
            console.log('文档API响应:', data);
            
            if (data.code === 0 && data.data && data.data.files && Array.isArray(data.data.files)) {
                console.log('加载到文档数量:', data.data.files.length);
                currentLevel2Docs.length = 0;
                currentLevel2Docs.push(...data.data.files);
                this.renderTreeItems(level2Container, currentLevel2Docs, onLevel2DocClick);
                
                // 恢复之前选中的二级文档
                if (savedLevel2DocPath) {
                    const savedDoc = currentLevel2Docs.find(doc => doc.path === savedLevel2DocPath);
                    if (savedDoc) {
                        setTimeout(() => {
                            onLevel2DocClick(savedDoc);
                            // 添加选中状态的视觉反馈
                            const docElements = level2Container.querySelectorAll('div');
                            docElements.forEach((el, index) => {
                                if (index < currentLevel2Docs.length && currentLevel2Docs[index].path === savedLevel2DocPath) {
                                    el.classList.add('selected');
                                }
                            });
                        }, 200);
                    }
                }
            } else {
                console.log('API返回错误或无数据:', data);
                level2Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">无文档数据</div>';
            }
             
             // 清空第三级和第四级
             level3Container.innerHTML = '';
             level4Container.innerHTML = '';
             currentLevel3Docs.length = 0;
             currentLevel4Docs.length = 0;
         } catch (error) {
             console.error('加载文档失败:', error);
             level2Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">加载失败</div>';
         }
     }

     private async loadSubDocuments(notebookId: string, parentPath: string, level3Container: HTMLDivElement, level4Container: HTMLDivElement, currentLevel3Docs: any[], currentLevel4Docs: any[], onLevel3DocClick: (doc: any) => void, savedLevel3DocPath?: string) {
         try {
             const response = await fetch('/api/filetree/listDocsByPath', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     notebook: notebookId,
                     path: parentPath,
                     maxListCount: 99999  // 设置为大数值以绕过系统默认512限制
                 })
             });
             const data = await response.json();
             
             if (data.code === 0 && data.data && data.data.files && Array.isArray(data.data.files)) {
                currentLevel3Docs.length = 0;
                currentLevel3Docs.push(...data.data.files);
                this.renderTreeItems(level3Container, currentLevel3Docs, onLevel3DocClick);
                // 清空第4级
                level4Container.innerHTML = '';
                currentLevel4Docs.length = 0;
                
                // 恢复之前选中的第3级文档
                if (savedLevel3DocPath) {
                    const savedDoc = currentLevel3Docs.find(doc => doc.path === savedLevel3DocPath);
                    if (savedDoc) {
                        setTimeout(() => {
                            onLevel3DocClick(savedDoc);
                            // 添加选中状态的视觉反馈
                            const docElements = level3Container.querySelectorAll('div');
                            docElements.forEach((el, index) => {
                                if (index < currentLevel3Docs.length && currentLevel3Docs[index].path === savedLevel3DocPath) {
                                    el.classList.add('selected');
                                }
                            });
                        }, 300);
                    }
                }
            } else {
                level3Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">无子文档数据</div>';
                level4Container.innerHTML = '';
                currentLevel4Docs.length = 0;
            }
         } catch (error) {
             console.error('加载子文档失败:', error);
             level3Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">加载失败</div>';
         }
     }

     private async loadLevel4Documents(notebookId: string, parentPath: string, level4Container: HTMLDivElement, currentLevel4Docs: any[], onLevel4DocClick: (doc: any) => void, savedLevel4DocPath?: string) {
         try {
             const response = await fetch('/api/filetree/listDocsByPath', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({
                     notebook: notebookId,
                     path: parentPath,
                     maxListCount: 99999  // 设置为大数值以绕过系统默认512限制
                 })
             });
             const data = await response.json();
             
             if (data.code === 0 && data.data && data.data.files && Array.isArray(data.data.files)) {
                currentLevel4Docs.length = 0;
                currentLevel4Docs.push(...data.data.files);
                this.renderTreeItems(level4Container, currentLevel4Docs, onLevel4DocClick);
                
                // 恢复之前选中的第4级文档
                if (savedLevel4DocPath) {
                    const savedDoc = currentLevel4Docs.find(doc => doc.path === savedLevel4DocPath);
                    if (savedDoc) {
                        setTimeout(() => {
                            // 找到对应的DOM元素并添加选中状态
                            const docElements = level4Container.querySelectorAll('div');
                            docElements.forEach((el, index) => {
                                if (index < currentLevel4Docs.length && currentLevel4Docs[index].path === savedLevel4DocPath) {
                                    el.classList.add('selected');
                                }
                            });
                        }, 400);
                    }
                }
            } else {
                level4Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">无深层文档数据</div>';
            }
         } catch (error) {
             console.error('加载第4级文档失败:', error);
             level4Container.innerHTML = '<div style="color: #ff6b6b; padding: 8px;">加载失败</div>';
         }
     }

     private renderTreeItems(container: HTMLDivElement, items: any[], onItemClick: (item: any) => void) {
         container.innerHTML = '';
         
         if (items.length === 0) {
             container.innerHTML = '<div style="color: #888; padding: 8px;">暂无数据</div>';
             return;
         }
         
         items.forEach(item => {
             const itemElement = document.createElement('div');
             itemElement.style.cssText = `
                 padding: 8px;
                 margin: 2px 0;
                 background: #3d3d3d;
                 border-radius: 4px;
                 cursor: pointer;
                 transition: background-color 0.2s;
                 border-left: 3px solid #0066cc;
             `;
             
             const rawName = item.name || item.hPath || '未命名';
             // 清理标题中的括号数字
             const name = this.cleanTitle(rawName);
             const icon = item.icon || (item.subFileCount > 0 ? '📁' : '📄');
             
             itemElement.innerHTML = `
                 <div style="display: flex; align-items: center; gap: 8px;">
                     <span style="font-size: 16px;">${icon}</span>
                     <span style="flex: 1; color: #fff; font-size: 14px;">${name}</span>
                 </div>
             `;
             
             // 鼠标悬停效果由CSS处理
             
             itemElement.addEventListener('click', () => {
                 console.log('点击项目:', item);
                 // 移除其他选中状态
                container.querySelectorAll('.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // 添加选中状态
                itemElement.classList.add('selected');
                 
                 console.log('调用回调函数');
                 onItemClick(item);
             });
             
             container.appendChild(itemElement);
         });
     }

     private filterTreeItems(container: HTMLDivElement, searchTerm: string, items: any[], onItemClick: (item: any) => void) {
         const filteredItems = items.filter(item => {
             const rawName = item.name || item.hPath || '';
             const name = this.cleanTitle(rawName);
             return name.toLowerCase().includes(searchTerm.toLowerCase());
         });
         
         this.renderTreeItems(container, filteredItems, onItemClick);
     }

    onload() {
        this.data[STORAGE_NAME] = {readonlyText: "Readonly"};

        // 在 onload() 方法中添加
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
        this.eventBus.on("open-menu-content", this.contentMenuEventBindThis);

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 图标的制作参见帮助文档
        this.addIcons(`<symbol id="iconFace" viewBox="0 0 32 32">
<path d="M13.667 17.333c0 0.92-0.747 1.667-1.667 1.667s-1.667-0.747-1.667-1.667 0.747-1.667 1.667-1.667 1.667 0.747 1.667 1.667zM20 15.667c-0.92 0-1.667 0.747-1.667 1.667s0.747 1.667 1.667 1.667 1.667-0.747 1.667-1.667-0.747-1.667-1.667-1.667zM29.333 16c0 7.36-5.973 13.333-13.333 13.333s-13.333-5.973-13.333-13.333 5.973-13.333 13.333-13.333 13.333 5.973 13.333 13.333zM14.213 5.493c1.867 3.093 5.253 5.173 9.12 5.173 0.613 0 1.213-0.067 1.787-0.16-1.867-3.093-5.253-5.173-9.12-5.173-0.613 0-1.213 0.067-1.787 0.16zM5.893 12.627c2.28-1.293 4.040-3.4 4.88-5.92-2.28 1.293-4.040 3.4-4.88 5.92zM26.667 16c0-1.040-0.16-2.040-0.44-2.987-0.933 0.2-1.893 0.32-2.893 0.32-4.173 0-7.893-1.92-10.347-4.92-1.4 3.413-4.187 6.093-7.653 7.4 0.013 0.053 0 0.12 0 0.187 0 5.88 4.787 10.667 10.667 10.667s10.667-4.787 10.667-10.667z"></path>
</symbol>
<symbol id="iconSaving" viewBox="0 0 32 32">
<path d="M20 13.333c0-0.733 0.6-1.333 1.333-1.333s1.333 0.6 1.333 1.333c0 0.733-0.6 1.333-1.333 1.333s-1.333-0.6-1.333-1.333zM10.667 12h6.667v-2.667h-6.667v2.667zM29.333 10v9.293l-3.76 1.253-2.24 7.453h-7.333v-2.667h-2.667v2.667h-7.333c0 0-3.333-11.28-3.333-15.333s3.28-7.333 7.333-7.333h6.667c1.213-1.613 3.147-2.667 5.333-2.667 1.107 0 2 0.893 2 2 0 0.28-0.053 0.533-0.16 0.773-0.187 0.453-0.347 0.973-0.427 1.533l3.027 3.027h2.893zM26.667 12.667h-1.333l-4.667-4.667c0-0.867 0.12-1.72 0.347-2.547-1.293 0.333-2.347 1.293-2.787 2.547h-8.227c-2.573 0-4.667 2.093-4.667 4.667 0 2.507 1.627 8.867 2.68 12.667h2.653v-2.667h8v2.667h2.68l2.067-6.867 3.253-1.093v-4.707z"></path>
</symbol>`);

        const topBarElement = this.addTopBar({
            icon: "iconFace",
            title: this.i18n.addTopBarIcon,
            position: "right",
            callback: () => {
                if (this.isMobile) {
                    this.addMenu();
                } else {
                    let rect = topBarElement.getBoundingClientRect();
                    // 如果被隐藏，则使用更多按钮
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document.querySelector("#barPlugins").getBoundingClientRect();
                    }
                    this.addMenu(rect);
                }
            }
        });

        const statusIconTemp = document.createElement("template");
        statusIconTemp.innerHTML = `<div class="toolbar__item ariaLabel" aria-label="Remove plugin-sample Data">
    <svg>
        <use xlink:href="#iconTrashcan"></use>
    </svg>
</div>`;
        statusIconTemp.content.firstElementChild.addEventListener("click", () => {
            confirm("⚠️", this.i18n.confirmRemove.replace("${name}", this.name), () => {
                this.removeData(STORAGE_NAME).then(() => {
                    this.data[STORAGE_NAME] = {readonlyText: "Readonly"};
                    showMessage(`[${this.name}]: ${this.i18n.removedData}`);
                });
            });
        });

        this.addStatusBar({
            element: statusIconTemp.content.firstElementChild as HTMLElement,
        });

        this.custom = this.addTab({
            type: TAB_TYPE,
            init() {
                this.element.innerHTML = `<div class="plugin-sample__custom-tab">${this.data.text}</div>`;
            },
            beforeDestroy() {
                console.log("before destroy tab:", TAB_TYPE);
            },
            destroy() {
                console.log("destroy tab:", TAB_TYPE);
            }
        });

        this.addCommand({
            langKey: "showDialog",
            hotkey: "⇧⌘O",
            callback: () => {
                this.showDialog();
            },
        });

        this.addCommand({
            langKey: "getTab",
            hotkey: "⇧⌘M",
            globalCallback: () => {
                console.log(this.getOpenedTab());
            },
        });
        this.addDock({
            config: {
                position: "LeftBottom",
                size: {width: 200, height: 0},
                icon: "iconSaving",
                title: "Custom Dock",
                hotkey: "⌥⌘W",
            },
            data: {
                text: "This is my custom dock"
            },
            type: DOCK_TYPE,
            resize() {
                console.log(DOCK_TYPE + " resize");
            },
            update() {
                console.log(DOCK_TYPE + " update");
            },
            init: (dock) => {
                if (this.isMobile) {
                    dock.element.innerHTML = `<div class="toolbar toolbar--border toolbar--dark">
    <svg class="toolbar__icon"><use xlink:href="#iconEmoji"></use></svg>
        <div class="toolbar__text">Custom Dock</div>
    </div>
    <div class="fn__flex-1 plugin-sample__custom-dock">
        ${dock.data.text}
    </div>
</div>`;
                } else {
                    dock.element.innerHTML = `<div class="fn__flex-1 fn__flex-column">
    <div class="block__icons">
        <div class="block__logo">
            <svg class="block__logoicon"><use xlink:href="#iconEmoji"></use></svg>Custom Dock
        </div>
        <span class="fn__flex-1 fn__space"></span>
        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ${adaptHotkey("⌘W")}"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__flex-1 plugin-sample__custom-dock">
        ${dock.data.text}
    </div>
</div>`;
                }
            },
            destroy() {
                console.log("destroy dock:", DOCK_TYPE);
            }
        });
        
        // 添加文件树侧边栏
        this.addDock({
            config: {
                position: "LeftTop",
                size: {width: 400, height: 0},
                icon: "iconFiles",
                title: "文档面板",
                hotkey: "⌥⌘T",
            },
            data: {
                text: "文档目录浏览器"
            },
            type: "file_tree_dock",
            resize() {
                console.log("file_tree_dock resize");
            },
            update() {
                console.log("file_tree_dock update");
            },
            init: (dock) => {
                dock.element.innerHTML = `<div class="fn__flex-1 fn__flex-column">
    <div class="block__icons">
        <div class="block__logo">
            <svg class="block__logoicon"><use xlink:href="#iconFiles"></use></svg>文档面板
        </div>
        <span class="fn__flex-1 fn__space"></span>
        <span id="dock-refresh-btn" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="获取文档面板信息" style="cursor: pointer;"><svg><use xlink:href="#iconRefresh"></use></svg></span>
        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ${adaptHotkey("⌘W")}"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__flex-1" style="padding: 4px; display: flex; flex-direction: row; gap: 4px;">
        <!-- 表1: 笔记本列表 -->
        <div class="file-tree-section" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d; height: 730px;">
            <div style="padding: 4px; border-bottom: 1px solid #444; background: #333; font-size: 14px; font-weight: bold;">表1 - 笔记本</div>
                <input type="text" id="dock-search-level-1" placeholder="搜索笔记本..." style="width: calc(100% - 8px); margin: 4px; padding: 2px; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 2px; font-size: 14px;">
                <div id="dock-tree-level-1" class="tree-list" style="height: calc(100% - 60px); overflow-y: auto; padding: 4px; font-size: 14px;"></div>
        </div>
        <!-- 表2: 文档列表 -->
        <div class="file-tree-section" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d; height: 730px;">
            <div style="padding: 4px; border-bottom: 1px solid #444; background: #333; font-size: 14px; font-weight: bold;">表2 - 文档</div>
                <input type="text" id="dock-search-level-2" placeholder="搜索文档..." style="width: calc(100% - 8px); margin: 4px; padding: 2px; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 2px; font-size: 14px;">
                <div id="dock-tree-level-2" class="tree-list" style="height: calc(100% - 60px); overflow-y: auto; padding: 4px; font-size: 14px;"></div>
        </div>
        <!-- 表3: 子文档列表 -->
        <div class="file-tree-section" style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2d2d2d; height: 730px;">
            <div style="padding: 4px; border-bottom: 1px solid #444; background: #333; font-size: 14px; font-weight: bold;">表3 - 子文档</div>
                <input type="text" id="dock-search-level-3" placeholder="搜索子文档..." style="width: calc(100% - 8px); margin: 4px; padding: 2px; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 2px; font-size: 14px;">
                <div id="dock-tree-level-3" class="tree-list" style="height: calc(100% - 60px); overflow-y: auto; padding: 4px; font-size: 14px;"></div>
        </div>
    </div>
</div>`;
                
                // 初始化文档目录组件
                this.initDocTreeDock(dock);
            },
            destroy() {
                console.log("destroy file_tree_dock");
            }
        });

        const textareaElement = document.createElement("textarea");
        this.setting = new Setting({
            confirmCallback: () => {
                this.saveData(STORAGE_NAME, {readonlyText: textareaElement.value});
            }
        });
        this.setting.addItem({
            title: "Readonly text",
            direction: "row",
            description: "Open plugin url in browser",
            createActionElement: () => {
                textareaElement.className = "b3-text-field fn__block";
                textareaElement.placeholder = "Readonly text in the menu";
                textareaElement.value = this.data[STORAGE_NAME].readonlyText;
                return textareaElement;
            },
        });
        const btnaElement = document.createElement("button");
        btnaElement.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        btnaElement.textContent = "Open";
        btnaElement.addEventListener("click", () => {
            window.open("https://github.com/siyuan-note/plugin-sample");
        });
        this.setting.addItem({
            title: "Open plugin url",
            description: "Open plugin url in browser",
            actionElement: btnaElement,
        });

        this.protyleSlash = [{
            filter: ["insert emoji 😊", "插入表情 😊", "crbqwx"],
            html: `<div class="b3-list-item__first"><span class="b3-list-item__text">${this.i18n.insertEmoji}</span><span class="b3-list-item__meta">😊</span></div>`,
            id: "insertEmoji",
            callback(protyle: Protyle, nodeElement: HTMLElement) {
                protyle.insert("😊");
            }
        }];

        this.protyleOptions = {
            toolbar: ["block-ref",
                "a",
                "|",
                "text",
                "strong",
                "em",
                "u",
                "s",
                "mark",
                "sup",
                "sub",
                "clear",
                "|",
                "code",
                "kbd",
                "tag",
                "inline-math",
                "inline-memo",
            ],
        };

        console.log(this.i18n.helloPlugin);
    }

    onLayoutReady() {
        this.loadData(STORAGE_NAME);
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
    }

    onunload() {
        console.log(this.i18n.byePlugin);
    }

    uninstall() {
        console.log("uninstall");
    }

    async updateCards(options: ICardData) {
        options.cards.sort((a: ICard, b: ICard) => {
            if (a.blockID < b.blockID) {
                return -1;
            }
            if (a.blockID > b.blockID) {
                return 1;
            }
            return 0;
        });
        return options;
    }

    /* 自定义设置
    openSetting() {
        const dialog = new Dialog({
            title: this.name,
            content: `<div class="b3-dialog__content"><textarea class="b3-text-field fn__block" placeholder="readonly text in the menu"></textarea></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${this.i18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${this.i18n.save}</button>
</div>`,
            width: this.isMobile ? "92vw" : "520px",
        });
        const inputElement = dialog.element.querySelector("textarea");
        inputElement.value = this.data[STORAGE_NAME].readonlyText;
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        dialog.bindInput(inputElement, () => {
            (btnsElement[1] as HTMLButtonElement).click();
        });
        inputElement.focus();
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            this.saveData(STORAGE_NAME, {readonlyText: inputElement.value});
            dialog.destroy();
        });
    }
    */

    private eventBusPaste(event: any) {
        // 如果需异步处理请调用 preventDefault， 否则会进行默认处理
        event.preventDefault();
        // 如果使用了 preventDefault，必须调用 resolve，否则程序会卡死
        event.detail.resolve({
            textPlain: event.detail.textPlain.trim(),
        });
    }

    private eventBusLog({detail}: any) {
        console.log(detail);
    }

    private blockIconEvent({detail}: any) {
        detail.menu.addItem({
            id: "pluginSample_removeSpace_test",
            iconHTML: "🔧",
            label: this.i18n.removeSpace,
            click: () => {
                const doOperations: IOperation[] = [];
                detail.blockElements.forEach((item: HTMLElement) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement) {
                        editElement.textContent = editElement.textContent.replace(/ /g, "");
                        doOperations.push({
                            id: item.dataset.nodeId,
                            data: item.outerHTML,
                            action: "update"
                        });
                    }
                });
                detail.protyle.getInstance().transaction(doOperations);
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_insertHelloWorld",
            iconHTML: "📝",
            label: "插入 Hello World",
            click: () => {
                const doOperations: IOperation[] = [];
                detail.blockElements.forEach((item: HTMLElement) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement) {
                        editElement.textContent = "# hello world";
                        doOperations.push({
                            id: item.dataset.nodeId,
                            data: item.outerHTML,
                            action: "update"
                        });
                    }
                });
                detail.protyle.getInstance().transaction(doOperations);
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_setBoldColor",
            iconHTML: "🎨",
            label: "设置粗体颜色",
            click: () => {
                this.showBoldColorSelector(detail);
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_setFontColor",
            iconHTML: "🖍️",
            label: "设置字体颜色",
            click: () => {
                this.showFontColorSelector(detail);
            }
        });
    }

    private contentMenuEvent({detail}: any) {
        detail.menu.addItem({
            id: "pluginSample_setBoldColorContent",
            iconHTML: "🎨",
            label: "设置粗体颜色",
            click: () => {
                this.showBoldColorSelectorForContent(detail);
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_setFontColorContent",
            iconHTML: "🖍️",
            label: "设置字体颜色",
            click: () => {
                this.showFontColorSelectorForContent(detail);
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_test",
            iconHTML: "🧪",
            label: "插入日期",
            click: () => {
                // 插入当前日期时间
                const now = new Date();
                const dateTimeString = now.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(dateTimeString));
                    selection.removeAllRanges();
                }
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_bing",
            iconHTML: "🔍",
            label: "Bing",
            click: () => {
                // 获取当前选中的文本
                const selection = window.getSelection();
                let selectedText = "thyme"; // 默认值
                
                if (selection && selection.toString().trim()) {
                    selectedText = selection.toString().trim();
                }
                
                // 构建Bing图片搜索URL，将thyme替换为选中的文本
                const searchUrl = `https://cn.bing.com/images/search?q=${encodeURIComponent(selectedText)}&qs=n&form=QBIR&sp=-1&lq=0&pq=${encodeURIComponent(selectedText)}&sc=10-5&cvid=FD7E1A9DE4C344D4A160B462C50F1D0C&first=1`;
                
                // 在默认浏览器中打开URL
                window.open(searchUrl, '_blank');
            }
        });
        
        detail.menu.addItem({
            id: "pluginSample_rhyme",
            iconHTML: "📖",
            label: "有道词典",
            click: () => {
                this.showYoudaoDict();
            }
        });
        

    }

    private showDialog() {
        const dialog = new Dialog({
            title: `SiYuan ${Constants.SIYUAN_VERSION}`,
            content: `<div class="b3-dialog__content">
    <div>appId:</div>
    <div class="fn__hr"></div>
    <div class="plugin-sample__time">${this.app.appId}</div>
    <div class="fn__hr"></div>
    <div class="fn__hr"></div>
    <div>API demo:</div>
    <div class="fn__hr"></div>
    <div class="plugin-sample__time">System current time: <span id="time"></span></div>
    <div class="fn__hr"></div>
    <div class="fn__hr"></div>
    <div>Protyle demo:</div>
    <div class="fn__hr"></div>
    <div id="protyle" style="height: 360px;"></div>
</div>`,
            width: this.isMobile ? "92vw" : "560px",
            height: "540px",
        });
        new Protyle(this.app, dialog.element.querySelector("#protyle"), {
            blockId: this.getEditor().protyle.block.rootID,
        });
        fetchPost("/api/system/currentTime", {}, (response) => {
            dialog.element.querySelector("#time").innerHTML = new Date(response.data).toString();
        });
    }

    private showDeepSeekDialog() {
        const dialog = new Dialog({
            title: "DeepSeek Chat",
            content: `<div class="b3-dialog__content" style="background: #1a1a1a; color: #ffffff;">
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ffffff;">Prompt:</label>
        <textarea id="deepseek-prompt" class="b3-text-field" style="width: 100%; height: 80px; background: #2d2d2d; color: #ffffff; border: 1px solid #444; resize: vertical; font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;" placeholder="请输入您的问题..."></textarea>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ffffff;">Output:</label>
        <textarea id="deepseek-output" class="b3-text-field" style="width: 100%; height: 300px; background: #2d2d2d; color: #ffffff; border: 1px solid #444; resize: vertical; font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;" readonly>等待输入...</textarea>
    </div>
</div>
<div class="b3-dialog__action" style="background: #1a1a1a; border-top: 1px solid #444;">
    <button class="b3-button b3-button--text" id="deepseek-submit" style="background: #0066cc; color: #fff; border: 1px solid #0066cc;">发送</button>
    <div class="fn__space"></div>
    <button class="b3-button" id="deepseek-stop" style="background: #dc3545; color: #fff; border: 1px solid #dc3545; display: none;">中断</button>
    <div class="fn__space"></div>
    <button class="b3-button" id="deepseek-copy" style="background: #28a745; color: #fff; border: 1px solid #28a745;">复制</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--cancel" style="background: #444; color: #fff; border: 1px solid #666;">取消</button>
</div>`,
            width: this.isMobile ? "92vw" : "700px",
            height: "600px",
        });

        const promptTextarea = dialog.element.querySelector("#deepseek-prompt") as HTMLTextAreaElement;
        const outputDiv = dialog.element.querySelector("#deepseek-output") as HTMLTextAreaElement;
        const submitBtn = dialog.element.querySelector("#deepseek-submit") as HTMLButtonElement;
        const stopBtn = dialog.element.querySelector("#deepseek-stop") as HTMLButtonElement;
        const copyBtn = dialog.element.querySelector("#deepseek-copy") as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        
        let currentAbortController: AbortController | null = null;

        cancelBtn.addEventListener("click", () => {
            dialog.destroy();
        });

        copyBtn.addEventListener("click", async () => {
            try {
                // 清空剪贴板
                await navigator.clipboard.writeText("");
                // 复制output内容
                const textContent = outputDiv.value || "";
                await navigator.clipboard.writeText(textContent);
                
                // 临时改变按钮文字提示复制成功
                const originalText = copyBtn.textContent;
                copyBtn.textContent = "已复制";
                copyBtn.style.background = "#218838";
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = "#28a745";
                }, 1500);
                
                showMessage("内容已复制到剪贴板", 2000, "info");
            } catch (error) {
                showMessage("复制失败: " + error.message, 3000, "error");
            }
        });

        stopBtn.addEventListener("click", () => {
            if (currentAbortController) {
                currentAbortController.abort();
                currentAbortController = null;
                submitBtn.disabled = false;
                submitBtn.textContent = "发送";
                stopBtn.style.display = "none";
                outputDiv.value += "\n\n[已中断]";
            }
        });

        submitBtn.addEventListener("click", async () => {
            const prompt = promptTextarea.value.trim();
            if (!prompt) {
                showMessage("请输入问题", 3000, "error");
                return;
            }

            currentAbortController = new AbortController();
            submitBtn.disabled = true;
            submitBtn.textContent = "发送中...";
            stopBtn.style.display = "inline-block";
            outputDiv.value = "正在思考...";

            try {
                await this.callDeepSeekAPI(prompt, outputDiv, currentAbortController);
            } catch (error) {
                if (error.name === 'AbortError') {
                    // 用户主动中断，不显示错误
                } else {
                    outputDiv.value = `错误: ${error.message}`;
                }
            } finally {
                currentAbortController = null;
                submitBtn.disabled = false;
                submitBtn.textContent = "发送";
                stopBtn.style.display = "none";
            }
        });

        // 支持回车发送
        promptTextarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitBtn.click();
            }
        });
    }

    private showDeepSeekReasonerDialog() {
        const dialog = new Dialog({
            title: "DeepSeek Reasoner",
            content: `<div class="b3-dialog__content" style="background: #1a1a1a; color: #ffffff;">
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ffffff;">Prompt:</label>
        <textarea id="reasoner-prompt" class="b3-text-field" style="width: 100%; height: 80px; background: #2d2d2d; color: #ffffff; border: 1px solid #444; resize: vertical; font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;" placeholder="请输入您的问题..."></textarea>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ffffff;">Reasoning:</label>
        <textarea id="reasoner-reasoning" class="b3-text-field" style="width: 100%; height: 150px; background: #2d2d2d; color: #ffffff; border: 1px solid #444; resize: vertical; font-family: 'Microsoft YaHei', '微软雅黑', sans-serif; border-left: 4px solid #ffc107;" readonly>等待输入...</textarea>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; color: #ffffff;">Output:</label>
        <textarea id="reasoner-output" class="b3-text-field" style="width: 100%; height: 150px; background: #2d2d2d; color: #ffffff; border: 1px solid #444; resize: vertical; font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;" readonly>等待输入...</textarea>
    </div>
</div>
<div class="b3-dialog__action" style="background: #1a1a1a; border-top: 1px solid #444;">
    <button class="b3-button b3-button--text" id="reasoner-submit" style="background: #0066cc; color: #fff; border: 1px solid #0066cc;">发送</button>
     <div class="fn__space"></div>
     <button class="b3-button" id="reasoner-stop" style="background: #dc3545; color: #fff; border: 1px solid #dc3545; display: none;">中断</button>
     <div class="fn__space"></div>
     <button class="b3-button" id="reasoner-copy-output" style="background: #28a745; color: #fff; border: 1px solid #28a745;">复制输出</button>
     <div class="fn__space"></div>
     <button class="b3-button" id="reasoner-copy-reasoning" style="background: #ffc107; color: #000; border: 1px solid #ffc107;">复制推理</button>
     <div class="fn__space"></div>
     <button class="b3-button b3-button--cancel" style="background: #444; color: #fff; border: 1px solid #666;">取消</button>
</div>`,
            width: this.isMobile ? "92vw" : "800px",
            height: "700px",
        });

        const promptTextarea = dialog.element.querySelector("#reasoner-prompt") as HTMLTextAreaElement;
        const reasoningDiv = dialog.element.querySelector("#reasoner-reasoning") as HTMLTextAreaElement;
        const outputDiv = dialog.element.querySelector("#reasoner-output") as HTMLTextAreaElement;
        const submitBtn = dialog.element.querySelector("#reasoner-submit") as HTMLButtonElement;
        const stopBtn = dialog.element.querySelector("#reasoner-stop") as HTMLButtonElement;
        const copyReasoningBtn = dialog.element.querySelector("#reasoner-copy-reasoning") as HTMLButtonElement;
        const copyOutputBtn = dialog.element.querySelector("#reasoner-copy-output") as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        
        let currentAbortController: AbortController | null = null;

        cancelBtn.addEventListener("click", () => {
            dialog.destroy();
        });

        copyReasoningBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText("");
                const textContent = reasoningDiv.value || "";
                await navigator.clipboard.writeText(textContent);
                
                const originalText = copyReasoningBtn.textContent;
                copyReasoningBtn.textContent = "已复制";
                copyReasoningBtn.style.background = "#e0a800";
                
                setTimeout(() => {
                    copyReasoningBtn.textContent = originalText;
                    copyReasoningBtn.style.background = "#ffc107";
                }, 1500);
                
                showMessage("推理过程已复制到剪贴板", 2000, "info");
            } catch (error) {
                showMessage("复制失败: " + error.message, 3000, "error");
            }
        });

        copyOutputBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText("");
                const textContent = outputDiv.value || "";
                await navigator.clipboard.writeText(textContent);
                
                const originalText = copyOutputBtn.textContent;
                copyOutputBtn.textContent = "已复制";
                copyOutputBtn.style.background = "#218838";
                
                setTimeout(() => {
                    copyOutputBtn.textContent = originalText;
                    copyOutputBtn.style.background = "#28a745";
                }, 1500);
                
                showMessage("输出内容已复制到剪贴板", 2000, "info");
            } catch (error) {
                showMessage("复制失败: " + error.message, 3000, "error");
            }
        });

        stopBtn.addEventListener("click", () => {
            if (currentAbortController) {
                currentAbortController.abort();
                currentAbortController = null;
                submitBtn.disabled = false;
                submitBtn.textContent = "发送";
                stopBtn.style.display = "none";
                reasoningDiv.value += "\n\n[已中断]";
                outputDiv.value += "\n\n[已中断]";
            }
        });

        submitBtn.addEventListener("click", async () => {
            const prompt = promptTextarea.value.trim();
            if (!prompt) {
                showMessage("请输入问题", 3000, "error");
                return;
            }

            currentAbortController = new AbortController();
            submitBtn.disabled = true;
            submitBtn.textContent = "发送中...";
            stopBtn.style.display = "inline-block";
            reasoningDiv.value = "正在思考...";
            outputDiv.value = "正在思考...";

            try {
                await this.callDeepSeekReasonerAPI(prompt, reasoningDiv, outputDiv, currentAbortController);
            } catch (error) {
                if (error.name === 'AbortError') {
                    // 用户主动中断，不显示错误
                } else {
                    outputDiv.value = `错误: ${error.message}`;
                }
            } finally {
                currentAbortController = null;
                submitBtn.disabled = false;
                submitBtn.textContent = "发送";
                stopBtn.style.display = "none";
            }
        });

        // 支持回车发送
        promptTextarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitBtn.click();
            }
        });
    }

    private async callDeepSeekAPI(prompt: string, outputDiv: HTMLTextAreaElement, abortController?: AbortController) {
        const apiKey = "sk-2d4c7566a3824c778b2f30fcbc620f0d";
        const apiUrl = "https://api.deepseek.com/v1/chat/completions";

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                stream: true
            }),
            signal: abortController?.signal
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder();
        outputDiv.value = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") {
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                outputDiv.value += content;
                                outputDiv.scrollTop = outputDiv.scrollHeight;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private async callDeepSeekReasonerAPI(prompt: string, reasoningDiv: HTMLTextAreaElement, outputDiv: HTMLTextAreaElement, abortController?: AbortController) {
        const apiKey = "sk-2d4c7566a3824c778b2f30fcbc620f0d";
        const apiUrl = "https://api.deepseek.com/v1/chat/completions";

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-reasoner",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                stream: true
            }),
            signal: abortController?.signal
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder();
        reasoningDiv.value = "";
            outputDiv.value = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") {
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const choice = parsed.choices?.[0];
                            
                            if (choice?.delta?.reasoning_content) {
                                reasoningDiv.value += choice.delta.reasoning_content;
                                reasoningDiv.scrollTop = reasoningDiv.scrollHeight;
                            }
                            
                            if (choice?.delta?.content) {
                                outputDiv.value += choice.delta.content;
                                outputDiv.scrollTop = outputDiv.scrollHeight;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("topBarSample", () => {
            console.log(this.i18n.byeMenu);
        });
        menu.addItem({
            icon: "iconSettings",
            label: "Open Setting",
            click: () => {
                openSetting(this.app);
            }
        });
        menu.addItem({
            icon: "iconDrag",
            label: "Open Attribute Panel",
            click: () => {
                openAttributePanel({
                    nodeElement: this.getEditor().protyle.wysiwyg.element.firstElementChild as HTMLElement,
                    protyle: this.getEditor().protyle,
                    focusName: "custom",
                });
            }
        });
        menu.addItem({
            icon: "iconInfo",
            label: "Dialog(open doc first)",
            accelerator: this.commands[0].customHotkey,
            click: () => {
                this.showDialog();
            }
        });
        menu.addItem({
            icon: "iconFocus",
            label: "Select Opened Doc(open doc first)",
            click: () => {
                (getModelByDockType("file") as Files).selectItem(this.getEditor().protyle.notebookId, this.getEditor().protyle.path);
            }
        });
        if (!this.isMobile) {
            menu.addItem({
                icon: "iconFace",
                label: "Open Custom Tab",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        custom: {
                            icon: "iconFace",
                            title: "Custom Tab",
                            data: {
                                text: platformUtils.isHuawei() ? "Hello, Huawei!" : "This is my custom tab",
                            },
                            id: this.name + TAB_TYPE
                        },
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconImage",
                label: "Open Asset Tab(First open the Chinese help document)",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        asset: {
                            path: "assets/paragraph-20210512165953-ag1nib4.svg"
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconFile",
                label: "Open Doc Tab(open doc first)",
                click: async () => {
                    const tab = await openTab({
                        app: this.app,
                        doc: {
                            id: this.getEditor().protyle.block.rootID,
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconSearch",
                label: "Open Search Tab",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        search: {
                            k: "SiYuan"
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconRiffCard",
                label: "Open Card Tab",
                click: () => {
                    const tab = openTab({
                        app: this.app,
                        card: {
                            type: "all"
                        }
                    });
                    console.log(tab);
                }
            });
            menu.addItem({
                icon: "iconLayout",
                label: "Open Float Layer(open doc first)",
                click: () => {
                    this.addFloatLayer({
                        refDefs: [{refID: this.getEditor().protyle.block.rootID}],
                        x: window.innerWidth - 768 - 120,
                        y: 32,
                        isBacklink: false
                    });
                }
            });
            menu.addItem({
                icon: "iconOpenWindow",
                label: "Open Doc Window(open doc first)",
                click: () => {
                    openWindow({
                        doc: {id: this.getEditor().protyle.block.rootID}
                    });
                }
            });
        } else {
            menu.addItem({
                icon: "iconFile",
                label: "Open Doc(open doc first)",
                click: () => {
                    openMobileFileById(this.app, this.getEditor().protyle.block.rootID);
                }
            });
        }
        menu.addItem({
            icon: "iconLock",
            label: "Lockscreen",
            click: () => {
                lockScreen(this.app);
            }
        });
        menu.addItem({
            icon: "iconFace",
            label: "💬 DeepSeek-Chat",
            click: () => {
                this.showDeepSeekDialog();
            }
        });
        menu.addItem({
            icon: "iconEdit",
            label: "📝 文章生成",
            click: () => {
                this.showArticleGeneratorDialog();
            }
        });
        menu.addItem({
            icon: "iconBrain",
            label: "🧠 DeepSeek-Reasoner",
            click: () => {
                this.showDeepSeekReasonerDialog();
            }
        });
        menu.addItem({
            icon: "iconFiles",
            label: "📁 目录",
            click: () => {
                this.showFileTreeDialog();
            }
        });
        menu.addItem({
            icon: "iconQuit",
            label: "Exit Application",
            click: () => {
                exitSiYuan();
            }
        });
        menu.addItem({
            icon: "iconScrollHoriz",
            label: "Event Bus",
            type: "submenu",
            submenu: [{
                icon: "iconSelect",
                label: "On ws-main",
                click: () => {
                    this.eventBus.on("ws-main", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off ws-main",
                click: () => {
                    this.eventBus.off("ws-main", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-blockicon",
                click: () => {
                    this.eventBus.on("click-blockicon", this.blockIconEventBindThis);
                }
            }, {
                icon: "iconClose",
                label: "Off click-blockicon",
                click: () => {
                    this.eventBus.off("click-blockicon", this.blockIconEventBindThis);
                }
            }, {
                icon: "iconSelect",
                label: "On click-pdf",
                click: () => {
                    this.eventBus.on("click-pdf", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-pdf",
                click: () => {
                    this.eventBus.off("click-pdf", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-editorcontent",
                click: () => {
                    this.eventBus.on("click-editorcontent", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-editorcontent",
                click: () => {
                    this.eventBus.off("click-editorcontent", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-editortitleicon",
                click: () => {
                    this.eventBus.on("click-editortitleicon", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-editortitleicon",
                click: () => {
                    this.eventBus.off("click-editortitleicon", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On click-flashcard-action",
                click: () => {
                    this.eventBus.on("click-flashcard-action", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off click-flashcard-action",
                click: () => {
                    this.eventBus.off("click-flashcard-action", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-noneditableblock",
                click: () => {
                    this.eventBus.on("open-noneditableblock", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-noneditableblock",
                click: () => {
                    this.eventBus.off("open-noneditableblock", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On loaded-protyle-static",
                click: () => {
                    this.eventBus.on("loaded-protyle-static", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off loaded-protyle-static",
                click: () => {
                    this.eventBus.off("loaded-protyle-static", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On loaded-protyle-dynamic",
                click: () => {
                    this.eventBus.on("loaded-protyle-dynamic", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off loaded-protyle-dynamic",
                click: () => {
                    this.eventBus.off("loaded-protyle-dynamic", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On switch-protyle",
                click: () => {
                    this.eventBus.on("switch-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off switch-protyle",
                click: () => {
                    this.eventBus.off("switch-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On destroy-protyle",
                click: () => {
                    this.eventBus.on("destroy-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off destroy-protyle",
                click: () => {
                    this.eventBus.off("destroy-protyle", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-doctree",
                click: () => {
                    this.eventBus.on("open-menu-doctree", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-doctree",
                click: () => {
                    this.eventBus.off("open-menu-doctree", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-blockref",
                click: () => {
                    this.eventBus.on("open-menu-blockref", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-blockref",
                click: () => {
                    this.eventBus.off("open-menu-blockref", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-fileannotationref",
                click: () => {
                    this.eventBus.on("open-menu-fileannotationref", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-fileannotationref",
                click: () => {
                    this.eventBus.off("open-menu-fileannotationref", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-tag",
                click: () => {
                    this.eventBus.on("open-menu-tag", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-tag",
                click: () => {
                    this.eventBus.off("open-menu-tag", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-link",
                click: () => {
                    this.eventBus.on("open-menu-link", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-link",
                click: () => {
                    this.eventBus.off("open-menu-link", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-image",
                click: () => {
                    this.eventBus.on("open-menu-image", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-image",
                click: () => {
                    this.eventBus.off("open-menu-image", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-av",
                click: () => {
                    this.eventBus.on("open-menu-av", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-av",
                click: () => {
                    this.eventBus.off("open-menu-av", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-content",
                click: () => {
                    this.eventBus.on("open-menu-content", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-content",
                click: () => {
                    this.eventBus.off("open-menu-content", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-breadcrumbmore",
                click: () => {
                    this.eventBus.on("open-menu-breadcrumbmore", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-breadcrumbmore",
                click: () => {
                    this.eventBus.off("open-menu-breadcrumbmore", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-menu-inbox",
                click: () => {
                    this.eventBus.on("open-menu-inbox", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-menu-inbox",
                click: () => {
                    this.eventBus.off("open-menu-inbox", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On input-search",
                click: () => {
                    this.eventBus.on("input-search", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off input-search",
                click: () => {
                    this.eventBus.off("input-search", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On paste",
                click: () => {
                    this.eventBus.on("paste", this.eventBusPaste);
                }
            }, {
                icon: "iconClose",
                label: "Off paste",
                click: () => {
                    this.eventBus.off("paste", this.eventBusPaste);
                }
            }, {
                icon: "iconSelect",
                label: "On open-siyuan-url-plugin",
                click: () => {
                    this.eventBus.on("open-siyuan-url-plugin", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-siyuan-url-plugin",
                click: () => {
                    this.eventBus.off("open-siyuan-url-plugin", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On open-siyuan-url-block",
                click: () => {
                    this.eventBus.on("open-siyuan-url-block", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off open-siyuan-url-block",
                click: () => {
                    this.eventBus.off("open-siyuan-url-block", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On opened-notebook",
                click: () => {
                    this.eventBus.on("opened-notebook", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off opened-notebook",
                click: () => {
                    this.eventBus.off("opened-notebook", this.eventBusLog);
                }
            }, {
                icon: "iconSelect",
                label: "On closed-notebook",
                click: () => {
                    this.eventBus.on("closed-notebook", this.eventBusLog);
                }
            }, {
                icon: "iconClose",
                label: "Off closed-notebook",
                click: () => {
                    this.eventBus.off("closed-notebook", this.eventBusLog);
                }
            }]
        });
        menu.addSeparator();
        menu.addItem({
            icon: "iconSparkles",
            label: this.data[STORAGE_NAME].readonlyText || "Readonly",
            type: "readonly",
        });
        if (this.isMobile) {
            menu.fullscreen();
        } else {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        }
    }

    /**
     * 获取文档面板信息，按层级输出表1、表2、表3中的信息
     */
    private async getDocumentPanelInfo() {
        try {
            console.log('\n=== 文档面板信息 ===');
            
            // 调试信息：检查docks对象状态
            console.log('当前docks对象:', this.docks);
            console.log('可用的dock类型:', Object.keys(this.docks));
            
            // 获取当前dock实例
            const dock = this.docks["plugin-samplefile_tree_dock"];
            if (!dock) {
                console.log('未找到文档面板dock');
                showMessage('未找到文档面板dock，请确保文档树面板已打开');
                return;
            }
            
            // 检查dock是否已初始化 - 直接查找DOM元素
            const level1Container = document.querySelector('#dock-tree-level-1');
            if (!level1Container) {
                console.log('dock未完全初始化，找不到DOM元素');
                showMessage('文档面板尚未完全加载，请稍后再试');
                return;
            }
            
            this.executeDocumentPanelInfo(dock);
            
        } catch (error) {
            console.error('获取文档面板信息失败:', error);
            showMessage('获取文档面板信息失败');
        }
    }
    
    /**
     * 执行文档面板信息获取的核心逻辑
     */
    private async executeDocumentPanelInfo(dock: any) {
        try {
            const level1Container = document.querySelector("#dock-tree-level-1") as HTMLDivElement;
            const level2Container = document.querySelector("#dock-tree-level-2") as HTMLDivElement;
            const level3Container = document.querySelector("#dock-tree-level-3") as HTMLDivElement;
            
            if (!level1Container || !level2Container || !level3Container) {
                console.log('未找到必要的容器元素');
                showMessage('文档面板结构不完整');
                return;
            }
            
            // 表1 - 笔记本信息
            console.log('\n=== 表1 - 笔记本列表 ===');
            const level1Items = level1Container.querySelectorAll('.tree-item');
            if (level1Items.length === 0) {
                console.log('表1为空 - 没有找到笔记本');
            } else {
                console.log(`找到 ${level1Items.length} 个笔记本:`);
                level1Items.forEach((item, index) => {
                    const nameElement = item.querySelector('span');
                    const name = nameElement ? nameElement.textContent : '未知';
                    const isSelected = item.style.background.includes('#4a90e2') || item.classList.contains('b3-list-item--focus');
                    console.log(`  ${index + 1}. 名称: "${name}" | 选中状态: ${isSelected ? '是' : '否'}`);
                });
            }
            
            // 表2 - 文档列表
            console.log('\n=== 表2 - 文档列表 ===');
            const level2Items = level2Container.querySelectorAll('.tree-item');
            if (level2Items.length === 0) {
                console.log('表2为空 - 未选择笔记本或笔记本为空');
            } else {
                console.log(`找到 ${level2Items.length} 个文档:`);
                level2Items.forEach((item, index) => {
                    const nameElement = item.querySelector('span');
                    const name = nameElement ? nameElement.textContent : '未知';
                    const isSelected = item.style.background.includes('#4a90e2') || item.classList.contains('b3-list-item--focus');
                    // 从文本中提取子文档数量
                    const text = name || '';
                    const subDocMatch = text.match(/\((\d+)\)$/);
                    const subDocCount = subDocMatch ? subDocMatch[1] : '0';
                    console.log(`  ${index + 1}. 名称: "${name}" | 子文档数: ${subDocCount} | 选中状态: ${isSelected ? '是' : '否'}`);
                });
            }
            
            // 表3 - 子文档列表
            console.log('\n=== 表3 - 子文档列表 ===');
            const level3Items = level3Container.querySelectorAll('.tree-item');
            if (level3Items.length === 0) {
                const emptyMessage = level3Container.textContent;
                console.log(`表3为空 - ${emptyMessage || '未选择父文档或无子文档'}`);
            } else {
                console.log(`找到 ${level3Items.length} 个子文档:`);
                level3Items.forEach((item, index) => {
                    const nameElement = item.querySelector('span');
                    const name = nameElement ? nameElement.textContent : '未知';
                    const isSelected = item.style.background.includes('#4a90e2') || item.classList.contains('b3-list-item--focus');
                    console.log(`  ${index + 1}. 名称: "${name}" | 选中状态: ${isSelected ? '是' : '否'}`);
                });
            }
            
            // 获取当前状态信息
            const savedState = await this.loadData(TREE_STATE_STORAGE) || {};
            console.log('\n=== 当前状态信息 ===');
            console.log('当前笔记本ID:', this.currentNotebookId || savedState.currentNotebookId || '未选择');
            console.log('当前Level2文档路径:', this.currentLevel2DocPath || savedState.currentLevel2DocPath || '未选择');
            console.log('当前Level3文档路径:', savedState.currentLevel3DocPath || '未选择');
            
            console.log('\n=== 文档面板信息获取完成 ===');
            showMessage('文档面板信息已输出到控制台');
            
        } catch (error) {
            console.error('执行文档面板信息获取失败:', error);
            showMessage('执行文档面板信息获取失败');
        }
    }

    private getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("please open doc first");
            return;
        }
        return editors[0];
    }

    private async showBoldColorSelector(detail: any) {
        // 加载保存的自定义颜色
        const savedColors = await this.loadData("custom-colors") || [];
        
        const dialog = new Dialog({
            title: "设置粗体颜色",
            content: `<div class="b3-dialog__content" style="background: #f5f5f5; padding: 20px;">
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预设颜色:</label>
        <div id="color-palette" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px;">
            <div class="color-option" data-color="#ff0000" style="width: 40px; height: 40px; background: #ff0000; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="红色"></div>
            <div class="color-option" data-color="#ff7f00" style="width: 40px; height: 40px; background: #ff7f00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="color-option" data-color="#ffff00" style="width: 40px; height: 40px; background: #ffff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="黄色"></div>
            <div class="color-option" data-color="#00ff00" style="width: 40px; height: 40px; background: #00ff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="绿色"></div>
            <div class="color-option" data-color="#0000ff" style="width: 40px; height: 40px; background: #0000ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="蓝色"></div>
            <div class="color-option" data-color="#8f00ff" style="width: 40px; height: 40px; background: #8f00ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
            <div class="color-option" data-color="#ff1493" style="width: 40px; height: 40px; background: #ff1493; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="深粉色"></div>
            <div class="color-option" data-color="#00ffff" style="width: 40px; height: 40px; background: #48B8BA; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="青色"></div>
            <div class="color-option" data-color="#ff69b4" style="width: 40px; height: 40px; background: #ff69b4; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="热粉色"></div>
            <div class="color-option" data-color="#32cd32" style="width: 40px; height: 40px; background: #32cd32; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="酸橙绿"></div>
            <div class="color-option" data-color="#ffa500" style="width: 40px; height: 40px; background: #ffa500; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="color-option" data-color="#800080" style="width: 40px; height: 40px; background: #800080; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">我的自定义颜色:</label>
        <div id="custom-color-palette" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; min-height: 48px; padding: 8px; border: 1px dashed #ccc; border-radius: 6px; background: #fafafa;">
            ${savedColors.length === 0 ? '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <label for="custom-color" style="font-weight: bold; color: #333;">选择颜色:</label>
            <input type="color" id="custom-color" value="#ff0000" style="width: 50px; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
            <button id="save-custom-color" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">保存颜色</button>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预览:</label>
        <div id="preview-text" style="font-size: 16px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white;">
            这是<strong style="color: #ff0000;">粗体文字</strong>的预览效果
        </div>
    </div>
</div>
<div class="b3-dialog__action" style="background: #f5f5f5; border-top: 1px solid #ddd; padding: 16px;">
    <button class="b3-button b3-button--text" id="apply-color" style="background: #0066cc; color: #fff; border: 1px solid #0066cc; margin-right: 8px;">确定</button>
    <button class="b3-button b3-button--cancel" style="background: #6c757d; color: #fff; border: 1px solid #6c757d;">取消</button>
</div>`,
            width: this.isMobile ? "92vw" : "420px",
            height: "580px",
        });

        let selectedColor = "#ff0000";
        const previewElement = dialog.element.querySelector("#preview-text strong") as HTMLElement;
        const customColorInput = dialog.element.querySelector("#custom-color") as HTMLInputElement;
        const applyBtn = dialog.element.querySelector("#apply-color") as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        const saveColorBtn = dialog.element.querySelector("#save-custom-color") as HTMLButtonElement;
        const customColorPalette = dialog.element.querySelector("#custom-color-palette") as HTMLElement;

        // 渲染已保存的自定义颜色
        const renderCustomColors = () => {
            if (savedColors.length === 0) {
                customColorPalette.innerHTML = '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>';
                return;
            }
            
            customColorPalette.innerHTML = savedColors.map((color: string, index: number) => 
                `<div class="custom-color-option" data-color="${color}" data-index="${index}" style="width: 40px; height: 40px; background: ${color}; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s; position: relative;" title="自定义颜色: ${color}">
                    <div class="delete-color" style="position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; background: #ff4444; color: white; border-radius: 50%; font-size: 10px; line-height: 16px; text-align: center; cursor: pointer; display: none;">×</div>
                </div>`
            ).join('');
            
            // 为自定义颜色添加事件监听器
            customColorPalette.querySelectorAll(".custom-color-option").forEach(option => {
                option.addEventListener("click", () => {
                    selectedColor = option.getAttribute("data-color");
                    previewElement.style.color = selectedColor;
                    customColorInput.value = selectedColor;
                    resetAllBorders();
                    (option as HTMLElement).style.border = "2px solid #0066cc";
                });

                // 悬停效果
                option.addEventListener("mouseenter", () => {
                    (option as HTMLElement).style.transform = "scale(1.1)";
                    const deleteBtn = option.querySelector(".delete-color") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "block";
                });
                
                option.addEventListener("mouseleave", () => {
                    (option as HTMLElement).style.transform = "scale(1)";
                    const deleteBtn = option.querySelector(".delete-color") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "none";
                });

                // 删除颜色
                const deleteBtn = option.querySelector(".delete-color");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const index = parseInt(option.getAttribute("data-index"));
                        savedColors.splice(index, 1);
                        await this.saveData("custom-colors", savedColors);
                        renderCustomColors();
                        showMessage("已删除自定义颜色", 1500, "info");
                    });
                }
            });
        };

        // 重置所有边框
        const resetAllBorders = () => {
            dialog.element.querySelectorAll(".color-option, .custom-color-option").forEach(opt => {
                (opt as HTMLElement).style.border = "2px solid #ccc";
            });
        };

        // 初始渲染自定义颜色
        renderCustomColors();

        // 保存自定义颜色
        saveColorBtn.addEventListener("click", async () => {
            const newColor = customColorInput.value;
            if (!savedColors.includes(newColor)) {
                if (savedColors.length >= 12) {
                    showMessage("最多只能保存12个自定义颜色", 2000, "warning");
                    return;
                }
                savedColors.push(newColor);
                await this.saveData("custom-colors", savedColors);
                renderCustomColors();
                showMessage(`已保存颜色 ${newColor}`, 1500, "info");
            } else {
                showMessage("该颜色已存在", 1500, "warning");
            }
        });

        // 处理预设颜色选择
        dialog.element.querySelectorAll(".color-option").forEach(option => {
            option.addEventListener("click", () => {
                selectedColor = option.getAttribute("data-color");
                previewElement.style.color = selectedColor;
                customColorInput.value = selectedColor;
                resetAllBorders();
                (option as HTMLElement).style.border = "2px solid #0066cc";
            });

            // 添加悬停效果
            option.addEventListener("mouseenter", () => {
                (option as HTMLElement).style.transform = "scale(1.1)";
            });
            option.addEventListener("mouseleave", () => {
                (option as HTMLElement).style.transform = "scale(1)";
            });
        });

        // 处理自定义颜色选择
        customColorInput.addEventListener("change", () => {
            selectedColor = customColorInput.value;
            previewElement.style.color = selectedColor;
            resetAllBorders();
        });

        // 取消按钮
        cancelBtn.addEventListener("click", () => {
            dialog.destroy();
        });

        // 确定按钮
        applyBtn.addEventListener("click", () => {
            this.setBoldTextColor(detail, selectedColor);
            dialog.destroy();
        });

        // 默认选中第一个颜色
        const firstOption = dialog.element.querySelector(".color-option") as HTMLElement;
        if (firstOption) {
            firstOption.style.border = "2px solid #0066cc";
        }
    }

    private setBoldTextColor(detail: any, color: string) {
        const doOperations: IOperation[] = [];
        
        detail.blockElements.forEach((item: HTMLElement) => {
            const editElement = item.querySelector('[contenteditable="true"]');
            if (editElement) {
                // 查找所有粗体元素
                const boldElements = editElement.querySelectorAll('strong, span[data-type~="strong"]');
                let hasChanges = false;
                
                boldElements.forEach((boldElement: HTMLElement) => {
                    // 检查当前选择是否包含这个粗体元素
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        
                        // 如果没有选择内容，则应用到所有粗体文字
                        if (range.collapsed || range.toString().trim() === '') {
                            boldElement.style.color = color;
                            hasChanges = true;
                        } else {
                            // 如果有选择，只应用到选择范围内的粗体文字
                            if (range.intersectsNode(boldElement)) {
                                boldElement.style.color = color;
                                hasChanges = true;
                            }
                        }
                    } else {
                        // 如果没有选择，应用到所有粗体文字
                        boldElement.style.color = color;
                        hasChanges = true;
                    }
                });
                
                if (hasChanges) {
                    doOperations.push({
                        id: item.dataset.nodeId,
                        data: item.outerHTML,
                        action: "update"
                    });
                }
            }
        });
        
        if (doOperations.length > 0) {
            detail.protyle.getInstance().transaction(doOperations);
            showMessage(`已设置粗体颜色为 ${color}`, 2000, "info");
        } else {
            showMessage("未找到粗体文字", 2000, "warning");
        }
    }

    private async showBoldColorSelectorForContent(detail: any) {
        // 检查是否有选中的文本
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
            showMessage("请先选择要设置颜色的文本内容", 2000, "warning");
            return;
        }

        // 加载保存的自定义颜色
        const savedColors = await this.loadData("custom-colors") || [];
        
        const dialog = new Dialog({
            title: "设置选中文本的粗体颜色",
            content: `<div class="b3-dialog__content" style="background: #f5f5f5; padding: 20px;">
    <div style="margin-bottom: 16px;">
        <div style="padding: 8px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; margin-bottom: 12px;">
            <strong>选中的文本:</strong> "${selection.toString().substring(0, 50)}${selection.toString().length > 50 ? '...' : ''}"
        </div>
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预设颜色:</label>
        <div id="color-palette-content" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px;">
            <div class="color-option-content" data-color="#ff0000" style="width: 40px; height: 40px; background: #ff0000; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="红色"></div>
            <div class="color-option-content" data-color="#ff7f00" style="width: 40px; height: 40px; background: #ff7f00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="color-option-content" data-color="#ffff00" style="width: 40px; height: 40px; background: #ffff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="黄色"></div>
            <div class="color-option-content" data-color="#00ff00" style="width: 40px; height: 40px; background: #00ff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="绿色"></div>
            <div class="color-option-content" data-color="#0000ff" style="width: 40px; height: 40px; background: #0000ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="蓝色"></div>
            <div class="color-option-content" data-color="#8f00ff" style="width: 40px; height: 40px; background: #8f00ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
            <div class="color-option-content" data-color="#ff1493" style="width: 40px; height: 40px; background: #ff1493; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="深粉色"></div>
            <div class="color-option-content" data-color="#00ffff" style="width: 40px; height: 40px; background: #48B8BA; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="青色"></div>
            <div class="color-option-content" data-color="#ff69b4" style="width: 40px; height: 40px; background: #ff69b4; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="热粉色"></div>
            <div class="color-option-content" data-color="#32cd32" style="width: 40px; height: 40px; background: #32cd32; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="酸橙绿"></div>
            <div class="color-option-content" data-color="#ffa500" style="width: 40px; height: 40px; background: #ffa500; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="color-option-content" data-color="#800080" style="width: 40px; height: 40px; background: #800080; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">我的自定义颜色:</label>
        <div id="custom-color-palette-content" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; min-height: 48px; padding: 8px; border: 1px dashed #ccc; border-radius: 6px; background: #fafafa;">
            ${savedColors.length === 0 ? '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <label for="custom-color-content" style="font-weight: bold; color: #333;">选择颜色:</label>
            <input type="color" id="custom-color-content" value="#ff0000" style="width: 50px; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
            <button id="save-custom-color-content" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">保存颜色</button>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预览:</label>
        <div id="preview-text-content" style="font-size: 16px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white;">
            这是<strong style="color: #ff0000;">粗体文字</strong>的预览效果
        </div>
    </div>
</div>
<div class="b3-dialog__action" style="background: #f5f5f5; border-top: 1px solid #ddd; padding: 16px;">
    <button class="b3-button b3-button--text" id="apply-color-content" style="background: #0066cc; color: #fff; border: 1px solid #0066cc; margin-right: 8px;">确定</button>
    <button class="b3-button b3-button--cancel" style="background: #6c757d; color: #fff; border: 1px solid #6c757d;">取消</button>
</div>`,
            width: this.isMobile ? "92vw" : "420px",
            height: "580px",
        });

        let selectedColor = "#ff0000";
        const previewElement = dialog.element.querySelector("#preview-text-content strong") as HTMLElement;
        const customColorInput = dialog.element.querySelector("#custom-color-content") as HTMLInputElement;
        const applyBtn = dialog.element.querySelector("#apply-color-content") as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        const saveColorBtn = dialog.element.querySelector("#save-custom-color-content") as HTMLButtonElement;
        const customColorPalette = dialog.element.querySelector("#custom-color-palette-content") as HTMLElement;

        // 渲染已保存的自定义颜色
        const renderCustomColors = () => {
            if (savedColors.length === 0) {
                customColorPalette.innerHTML = '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>';
                return;
            }
            
            customColorPalette.innerHTML = savedColors.map((color: string, index: number) => 
                `<div class="custom-color-option-content" data-color="${color}" data-index="${index}" style="width: 40px; height: 40px; background: ${color}; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s; position: relative;" title="自定义颜色: ${color}">
                    <div class="delete-color-content" style="position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; background: #ff4444; color: white; border-radius: 50%; font-size: 10px; line-height: 16px; text-align: center; cursor: pointer; display: none;">×</div>
                </div>`
            ).join('');
            
            // 为自定义颜色添加事件监听器
            customColorPalette.querySelectorAll(".custom-color-option-content").forEach(option => {
                option.addEventListener("click", () => {
                    selectedColor = option.getAttribute("data-color");
                    previewElement.style.color = selectedColor;
                    customColorInput.value = selectedColor;
                    resetAllBorders();
                    (option as HTMLElement).style.border = "2px solid #0066cc";
                });

                // 悬停效果
                option.addEventListener("mouseenter", () => {
                    (option as HTMLElement).style.transform = "scale(1.1)";
                    const deleteBtn = option.querySelector(".delete-color-content") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "block";
                });
                
                option.addEventListener("mouseleave", () => {
                    (option as HTMLElement).style.transform = "scale(1)";
                    const deleteBtn = option.querySelector(".delete-color-content") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "none";
                });

                // 删除颜色
                const deleteBtn = option.querySelector(".delete-color-content");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const index = parseInt(option.getAttribute("data-index"));
                        savedColors.splice(index, 1);
                        await this.saveData("custom-colors", savedColors);
                        renderCustomColors();
                        showMessage("已删除自定义颜色", 1500, "info");
                    });
                }
            });
        };

        // 重置所有边框
        const resetAllBorders = () => {
            dialog.element.querySelectorAll(".color-option-content, .custom-color-option-content").forEach(opt => {
                (opt as HTMLElement).style.border = "2px solid #ccc";
            });
        };

        // 初始渲染自定义颜色
        renderCustomColors();

        // 保存自定义颜色
        saveColorBtn.addEventListener("click", async () => {
            const newColor = customColorInput.value;
            if (!savedColors.includes(newColor)) {
                if (savedColors.length >= 12) {
                    showMessage("最多只能保存12个自定义颜色", 2000, "warning");
                    return;
                }
                savedColors.push(newColor);
                await this.saveData("custom-colors", savedColors);
                renderCustomColors();
                showMessage(`已保存颜色 ${newColor}`, 1500, "info");
            } else {
                showMessage("该颜色已存在", 1500, "warning");
            }
        });

        // 处理预设颜色选择
        dialog.element.querySelectorAll(".color-option-content").forEach(option => {
            option.addEventListener("click", () => {
                selectedColor = option.getAttribute("data-color");
                previewElement.style.color = selectedColor;
                customColorInput.value = selectedColor;
                resetAllBorders();
                (option as HTMLElement).style.border = "2px solid #0066cc";
            });

            // 添加悬停效果
            option.addEventListener("mouseenter", () => {
                (option as HTMLElement).style.transform = "scale(1.1)";
            });
            option.addEventListener("mouseleave", () => {
                (option as HTMLElement).style.transform = "scale(1)";
            });
        });

        // 处理自定义颜色选择
        customColorInput.addEventListener("change", () => {
            selectedColor = customColorInput.value;
            previewElement.style.color = selectedColor;
            resetAllBorders();
        });

        // 取消按钮
        cancelBtn.addEventListener("click", () => {
            dialog.destroy();
        });

        // 确定按钮 - 专门处理选中的内容
        applyBtn.addEventListener("click", () => {
            this.setBoldTextColorForSelection(selectedColor);
            dialog.destroy();
        });

        // 默认选中第一个颜色
        const firstOption = dialog.element.querySelector(".color-option-content") as HTMLElement;
        if (firstOption) {
            firstOption.style.border = "2px solid #0066cc";
        }
    }

    private setBoldTextColorForSelection(color: string) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            showMessage("没有选中的文本", 2000, "warning");
            return;
        }

        const range = selection.getRangeAt(0);
        if (range.collapsed || range.toString().trim() === '') {
            showMessage("请选择要设置颜色的文本", 2000, "warning");
            return;
        }

        try {
            // 获取选中范围内的所有粗体元素
            const fragment = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);
            
            // 查找粗体元素
            const boldElements = tempDiv.querySelectorAll('strong, span[data-type~="strong"]');
            
            if (boldElements.length === 0) {
                showMessage("选中的内容中没有粗体文字", 2000, "warning");
                return;
            }

            // 在原始选择范围内查找并设置粗体元素的颜色
            const container = range.commonAncestorContainer;
            let parentElement: Element;
            
            if (container.nodeType === Node.TEXT_NODE) {
                parentElement = container.parentElement;
            } else {
                parentElement = container as Element;
            }

            // 查找父元素及其子元素中的粗体标签
            const allBoldElements = parentElement.querySelectorAll('strong, span[data-type~="strong"]');
            let hasChanges = false;

            allBoldElements.forEach((boldElement: HTMLElement) => {
                // 检查粗体元素是否在选择范围内
                if (range.intersectsNode(boldElement)) {
                    boldElement.style.color = color;
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                // 触发保存
                const blockElement = parentElement.closest('[data-node-id]') as HTMLElement;
                if (blockElement) {
                    const doOperations: IOperation[] = [{
                        id: blockElement.dataset.nodeId,
                        data: blockElement.outerHTML,
                        action: "update"
                    }];
                    
                    // 获取protyle实例
                    const protyleElement = blockElement.closest('.protyle-wysiwyg');
                    if (protyleElement) {
                        const protyle = (protyleElement as any).protyle;
                        if (protyle) {
                            protyle.transaction(doOperations);
                        }
                    }
                }
                
                showMessage(`已设置选中文本的粗体颜色为 ${color}`, 2000, "info");
                
                // 清除选择
                selection.removeAllRanges();
            } else {
                showMessage("选中的内容中没有粗体文字", 2000, "warning");
            }
        } catch (error) {
            console.error('设置粗体颜色时出错:', error);
            showMessage("设置颜色时出错，请重试", 2000, "error");
        }
    }

    private async renameNotebook(notebookId: string, newName: string) {
        try {
            const response = await fetch('/api/notebook/renameNotebook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    name: newName
                })
            });
            
            const result = await response.json();
            if (result.code === 0) {
                showMessage('笔记本重命名成功');
            } else {
                showMessage(`重命名失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('重命名笔记本时出错:', error);
            showMessage('重命名失败，请重试');
        }
    }

    private async renameDocument(notebookId: string, docPath: string, newTitle: string) {
        try {
            const response = await fetch('/api/filetree/renameDoc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    path: docPath,
                    title: newTitle
                })
            });
            
            const result = await response.json();
            if (result.code === 0) {
                showMessage('文档重命名成功');
            } else {
                showMessage(`重命名失败: ${result.msg}`);
            }
        } catch (error) {
            console.error('重命名文档时出错:', error);
            showMessage('重命名失败，请重试');
        }
    }

    private async showFontColorSelector(detail: any) {
        // 加载保存的自定义颜色
        const savedColors = await this.loadData("custom-colors") || [];
        
        const dialog = new Dialog({
            title: "设置字体颜色",
            content: `<div class="b3-dialog__content" style="background: #f5f5f5; padding: 20px;">
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预设颜色:</label>
        <div id="font-color-palette" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px;">
            <div class="font-color-option" data-color="#ff0000" style="width: 40px; height: 40px; background: #ff0000; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="红色"></div>
            <div class="font-color-option" data-color="#ff7f00" style="width: 40px; height: 40px; background: #ff7f00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="font-color-option" data-color="#ffff00" style="width: 40px; height: 40px; background: #ffff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="黄色"></div>
            <div class="font-color-option" data-color="#00ff00" style="width: 40px; height: 40px; background: #00ff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="绿色"></div>
            <div class="font-color-option" data-color="#0000ff" style="width: 40px; height: 40px; background: #0000ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="蓝色"></div>
            <div class="font-color-option" data-color="#8f00ff" style="width: 40px; height: 40px; background: #8f00ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
            <div class="font-color-option" data-color="#ff1493" style="width: 40px; height: 40px; background: #ff1493; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="深粉色"></div>
            <div class="font-color-option" data-color="#00ffff" style="width: 40px; height: 40px; background: #48B8BA; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="青色"></div>
            <div class="font-color-option" data-color="#ff69b4" style="width: 40px; height: 40px; background: #ff69b4; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="热粉色"></div>
            <div class="font-color-option" data-color="#32cd32" style="width: 40px; height: 40px; background: #32cd32; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="酸橙绿"></div>
            <div class="font-color-option" data-color="#ffa500" style="width: 40px; height: 40px; background: #ffa500; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="font-color-option" data-color="#800080" style="width: 40px; height: 40px; background: #800080; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">我的自定义颜色:</label>
        <div id="custom-font-color-palette" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; min-height: 48px; padding: 8px; border: 1px dashed #ccc; border-radius: 6px; background: #fafafa;">
            ${savedColors.length === 0 ? '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <label for="custom-font-color" style="font-weight: bold; color: #333;">选择颜色:</label>
            <input type="color" id="custom-font-color" value="#ff0000" style="width: 50px; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
            <button id="save-custom-font-color" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">保存颜色</button>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预览:</label>
        <div id="font-preview-text" style="font-size: 16px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white;">
            这是<span style="color: #ff0000;">字体颜色</span>的预览效果
        </div>
    </div>
</div>
<div class="b3-dialog__action" style="background: #f5f5f5; border-top: 1px solid #ddd; padding: 16px;">
    <button class="b3-button b3-button--text" id="apply-font-color" style="background: #0066cc; color: #fff; border: 1px solid #0066cc; margin-right: 8px;">确定</button>
    <button class="b3-button b3-button--cancel" style="background: #6c757d; color: #fff; border: 1px solid #6c757d;">取消</button>
</div>`,
            width: this.isMobile ? "92vw" : "420px",
            height: "580px",
        });

        let selectedColor = "#ff0000";
        const previewElement = dialog.element.querySelector("#font-preview-text span") as HTMLElement;
        const customColorInput = dialog.element.querySelector("#custom-font-color") as HTMLInputElement;
        const applyBtn = dialog.element.querySelector("#apply-font-color") as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        const saveColorBtn = dialog.element.querySelector("#save-custom-font-color") as HTMLButtonElement;
        const customColorPalette = dialog.element.querySelector("#custom-font-color-palette") as HTMLElement;

        // 渲染已保存的自定义颜色
        const renderCustomColors = () => {
            if (savedColors.length === 0) {
                customColorPalette.innerHTML = '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>';
                return;
            }
            
            customColorPalette.innerHTML = savedColors.map((color: string, index: number) => 
                `<div class="custom-font-color-option" data-color="${color}" data-index="${index}" style="width: 40px; height: 40px; background: ${color}; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s; position: relative;" title="自定义颜色: ${color}">
                    <div class="delete-font-color" style="position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; background: #ff4444; color: white; border-radius: 50%; font-size: 10px; line-height: 16px; text-align: center; cursor: pointer; display: none;">×</div>
                </div>`
            ).join('');
            
            // 为自定义颜色添加事件监听器
            customColorPalette.querySelectorAll(".custom-font-color-option").forEach(option => {
                option.addEventListener("click", () => {
                    selectedColor = option.getAttribute("data-color");
                    previewElement.style.color = selectedColor;
                    customColorInput.value = selectedColor;
                    resetAllBorders();
                    (option as HTMLElement).style.border = "2px solid #0066cc";
                });

                // 悬停效果
                option.addEventListener("mouseenter", () => {
                    (option as HTMLElement).style.transform = "scale(1.1)";
                    const deleteBtn = option.querySelector(".delete-font-color") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "block";
                });
                
                option.addEventListener("mouseleave", () => {
                    (option as HTMLElement).style.transform = "scale(1)";
                    const deleteBtn = option.querySelector(".delete-font-color") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "none";
                });

                // 删除颜色
                const deleteBtn = option.querySelector(".delete-font-color");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const index = parseInt(option.getAttribute("data-index"));
                        savedColors.splice(index, 1);
                        await this.saveData("custom-colors", savedColors);
                        renderCustomColors();
                        showMessage("已删除自定义颜色", 1500, "info");
                    });
                }
            });
        };

        // 重置所有边框
        const resetAllBorders = () => {
            dialog.element.querySelectorAll(".font-color-option, .custom-font-color-option").forEach(opt => {
                (opt as HTMLElement).style.border = "2px solid #ccc";
            });
        };

        // 初始渲染自定义颜色
        renderCustomColors();

        // 保存自定义颜色
        saveColorBtn.addEventListener("click", async () => {
            const newColor = customColorInput.value;
            if (!savedColors.includes(newColor)) {
                if (savedColors.length >= 12) {
                    showMessage("最多只能保存12个自定义颜色", 2000, "warning");
                    return;
                }
                savedColors.push(newColor);
                await this.saveData("custom-colors", savedColors);
                renderCustomColors();
                showMessage(`已保存颜色 ${newColor}`, 1500, "info");
            } else {
                showMessage("该颜色已存在", 1500, "warning");
            }
        });

        // 处理预设颜色选择
        dialog.element.querySelectorAll(".font-color-option").forEach(option => {
            option.addEventListener("click", () => {
                selectedColor = option.getAttribute("data-color");
                previewElement.style.color = selectedColor;
                customColorInput.value = selectedColor;
                resetAllBorders();
                (option as HTMLElement).style.border = "2px solid #0066cc";
            });

            // 添加悬停效果
            option.addEventListener("mouseenter", () => {
                (option as HTMLElement).style.transform = "scale(1.1)";
            });
            option.addEventListener("mouseleave", () => {
                (option as HTMLElement).style.transform = "scale(1)";
            });
        });

        // 处理自定义颜色选择
        customColorInput.addEventListener("change", () => {
            selectedColor = customColorInput.value;
            previewElement.style.color = selectedColor;
            resetAllBorders();
        });

        // 取消按钮
        cancelBtn.addEventListener("click", () => {
            dialog.destroy();
        });

        // 确定按钮
        applyBtn.addEventListener("click", () => {
            this.setFontTextColor(detail, selectedColor);
            dialog.destroy();
        });

        // 默认选中第一个颜色
        const firstOption = dialog.element.querySelector(".font-color-option") as HTMLElement;
        if (firstOption) {
            firstOption.style.border = "2px solid #0066cc";
        }
    }

    private setFontTextColor(detail: any, color: string) {
        const doOperations: IOperation[] = [];
        
        detail.blockElements.forEach((item: HTMLElement) => {
            const editElement = item.querySelector('[contenteditable="true"]');
            if (editElement) {
                let hasChanges = false;
                const selection = window.getSelection();
                
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    
                    // 如果没有选择内容，则应用到整个块的所有文本
                    if (range.collapsed || range.toString().trim() === '') {
                        editElement.style.color = color;
                        hasChanges = true;
                    } else {
                        // 如果有选择，只应用到选择范围内的文本
                        if (range.intersectsNode(editElement)) {
                            editElement.style.color = color;
                            hasChanges = true;
                        }
                    }
                } else {
                    // 如果没有选择，应用到整个块的所有文本
                    editElement.style.color = color;
                    hasChanges = true;
                }
                
                if (hasChanges) {
                    doOperations.push({
                        id: item.dataset.nodeId,
                        data: item.outerHTML,
                        action: "update"
                    });
                }
            }
        });
        
        if (doOperations.length > 0) {
            detail.protyle.getInstance().transaction(doOperations);
            showMessage(`已设置字体颜色为 ${color}`, 2000, "info");
        } else {
            showMessage("未找到可设置颜色的文本", 2000, "warning");
        }
    }

    private async showFontColorSelectorForContent(detail: any) {
        // 检查是否有选中的文本
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
            showMessage("请先选择要设置颜色的文本内容", 2000, "warning");
            return;
        }

        // 加载保存的自定义颜色
        const savedColors = await this.loadData("custom-colors") || [];
        
        const dialog = new Dialog({
            title: "设置选中文本的字体颜色",
            content: `<div class="b3-dialog__content" style="background: #f5f5f5; padding: 20px;">
    <div style="margin-bottom: 16px;">
        <div style="padding: 8px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; margin-bottom: 12px;">
            <strong>选中的文本:</strong> "${selection.toString().substring(0, 50)}${selection.toString().length > 50 ? '...' : ''}"
        </div>
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预设颜色:</label>
        <div id="font-color-palette-content" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px;">
            <div class="font-color-option-content" data-color="#ff0000" style="width: 40px; height: 40px; background: #ff0000; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="红色"></div>
            <div class="font-color-option-content" data-color="#ff7f00" style="width: 40px; height: 40px; background: #ff7f00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="font-color-option-content" data-color="#ffff00" style="width: 40px; height: 40px; background: #ffff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="黄色"></div>
            <div class="font-color-option-content" data-color="#00ff00" style="width: 40px; height: 40px; background: #00ff00; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="绿色"></div>
            <div class="font-color-option-content" data-color="#0000ff" style="width: 40px; height: 40px; background: #0000ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="蓝色"></div>
            <div class="font-color-option-content" data-color="#8f00ff" style="width: 40px; height: 40px; background: #8f00ff; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
            <div class="font-color-option-content" data-color="#ff1493" style="width: 40px; height: 40px; background: #ff1493; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="深粉色"></div>
            <div class="font-color-option-content" data-color="#00ffff" style="width: 40px; height: 40px; background: #48B8BA; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="青色"></div>
            <div class="font-color-option-content" data-color="#ff69b4" style="width: 40px; height: 40px; background: #ff69b4; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="热粉色"></div>
            <div class="font-color-option-content" data-color="#32cd32" style="width: 40px; height: 40px; background: #32cd32; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="酸橙绿"></div>
            <div class="font-color-option-content" data-color="#ffa500" style="width: 40px; height: 40px; background: #ffa500; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="橙色"></div>
            <div class="font-color-option-content" data-color="#800080" style="width: 40px; height: 40px; background: #800080; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s;" title="紫色"></div>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">我的自定义颜色:</label>
        <div id="custom-font-color-palette-content" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; min-height: 48px; padding: 8px; border: 1px dashed #ccc; border-radius: 6px; background: #fafafa;">
            ${savedColors.length === 0 ? '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <label for="custom-font-color-content" style="font-weight: bold; color: #333;">选择颜色:</label>
            <input type="color" id="custom-font-color-content" value="#ff0000" style="width: 50px; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
            <button id="save-custom-font-color-content" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">保存颜色</button>
        </div>
    </div>
    <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">预览:</label>
        <div id="font-preview-text-content" style="font-size: 16px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: white;">
            这是<span style="color: #ff0000;">字体颜色</span>的预览效果
        </div>
    </div>
</div>
<div class="b3-dialog__action" style="background: #f5f5f5; border-top: 1px solid #ddd; padding: 16px;">
    <button class="b3-button b3-button--text" id="apply-font-color-content" style="background: #0066cc; color: #fff; border: 1px solid #0066cc; margin-right: 8px;">确定</button>
    <button class="b3-button b3-button--cancel" style="background: #6c757d; color: #fff; border: 1px solid #6c757d;">取消</button>
</div>`,
            width: this.isMobile ? "92vw" : "420px",
            height: "580px",
        });

        let selectedColor = "#ff0000";
        const previewElement = dialog.element.querySelector("#font-preview-text-content span") as HTMLElement;
        const customColorInput = dialog.element.querySelector("#custom-font-color-content") as HTMLInputElement;
        const applyBtn = dialog.element.querySelector("#apply-font-color-content") as HTMLButtonElement;
        const cancelBtn = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
        const saveColorBtn = dialog.element.querySelector("#save-custom-font-color-content") as HTMLButtonElement;
        const customColorPalette = dialog.element.querySelector("#custom-font-color-palette-content") as HTMLElement;

        // 渲染已保存的自定义颜色
        const renderCustomColors = () => {
            if (savedColors.length === 0) {
                customColorPalette.innerHTML = '<span style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 14px; line-height: 32px;">暂无保存的自定义颜色</span>';
                return;
            }
            
            customColorPalette.innerHTML = savedColors.map((color: string, index: number) => 
                `<div class="custom-font-color-option-content" data-color="${color}" data-index="${index}" style="width: 40px; height: 40px; background: ${color}; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: all 0.2s; position: relative;" title="自定义颜色: ${color}">
                    <div class="delete-font-color-content" style="position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; background: #ff4444; color: white; border-radius: 50%; font-size: 10px; line-height: 16px; text-align: center; cursor: pointer; display: none;">×</div>
                </div>`
            ).join('');
            
            // 为自定义颜色添加事件监听器
            customColorPalette.querySelectorAll(".custom-font-color-option-content").forEach(option => {
                option.addEventListener("click", () => {
                    selectedColor = option.getAttribute("data-color");
                    previewElement.style.color = selectedColor;
                    customColorInput.value = selectedColor;
                    resetAllBorders();
                    (option as HTMLElement).style.border = "2px solid #0066cc";
                });

                // 悬停效果
                option.addEventListener("mouseenter", () => {
                    (option as HTMLElement).style.transform = "scale(1.1)";
                    const deleteBtn = option.querySelector(".delete-font-color-content") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "block";
                });
                
                option.addEventListener("mouseleave", () => {
                    (option as HTMLElement).style.transform = "scale(1)";
                    const deleteBtn = option.querySelector(".delete-font-color-content") as HTMLElement;
                    if (deleteBtn) deleteBtn.style.display = "none";
                });

                // 删除颜色
                const deleteBtn = option.querySelector(".delete-font-color-content");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const index = parseInt(option.getAttribute("data-index"));
                        savedColors.splice(index, 1);
                        await this.saveData("custom-colors", savedColors);
                        renderCustomColors();
                        showMessage("已删除自定义颜色", 1500, "info");
                    });
                }
            });
        };

        // 重置所有边框
        const resetAllBorders = () => {
            dialog.element.querySelectorAll(".font-color-option-content, .custom-font-color-option-content").forEach(opt => {
                (opt as HTMLElement).style.border = "2px solid #ccc";
            });
        };

        // 初始渲染自定义颜色
        renderCustomColors();

        // 保存自定义颜色
        saveColorBtn.addEventListener("click", async () => {
            const newColor = customColorInput.value;
            if (!savedColors.includes(newColor)) {
                if (savedColors.length >= 12) {
                    showMessage("最多只能保存12个自定义颜色", 2000, "warning");
                    return;
                }
                savedColors.push(newColor);
                await this.saveData("custom-colors", savedColors);
                renderCustomColors();
                showMessage(`已保存颜色 ${newColor}`, 1500, "info");
            } else {
                showMessage("该颜色已存在", 1500, "warning");
            }
        });

        // 处理预设颜色选择
        dialog.element.querySelectorAll(".font-color-option-content").forEach(option => {
            option.addEventListener("click", () => {
                selectedColor = option.getAttribute("data-color");
                previewElement.style.color = selectedColor;
                customColorInput.value = selectedColor;
                resetAllBorders();
                (option as HTMLElement).style.border = "2px solid #0066cc";
            });

            // 添加悬停效果
            option.addEventListener("mouseenter", () => {
                (option as HTMLElement).style.transform = "scale(1.1)";
            });
            option.addEventListener("mouseleave", () => {
                (option as HTMLElement).style.transform = "scale(1)";
            });
        });

        // 处理自定义颜色选择
        customColorInput.addEventListener("change", () => {
            selectedColor = customColorInput.value;
            previewElement.style.color = selectedColor;
            resetAllBorders();
        });

        // 取消按钮
        cancelBtn.addEventListener("click", () => {
            dialog.destroy();
        });

        // 确定按钮
        applyBtn.addEventListener("click", () => {
            this.setFontTextColorForSelection(selectedColor);
            dialog.destroy();
        });

        // 默认选中第一个颜色
        const firstOption = dialog.element.querySelector(".font-color-option-content") as HTMLElement;
        if (firstOption) {
            firstOption.style.border = "2px solid #0066cc";
        }
    }

    private setFontTextColorForSelection(color: string) {
        try {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                showMessage("请先选择要设置颜色的文本", 2000, "warning");
                return;
            }

            const range = selection.getRangeAt(0);
            if (range.collapsed || range.toString().trim() === '') {
                showMessage("请先选择要设置颜色的文本", 2000, "warning");
                return;
            }

            // 创建一个span元素来包装选中的文本并设置颜色
            const span = document.createElement('span');
            span.style.color = color;
            
            try {
                // 将选中的内容包装在span中
                range.surroundContents(span);
                
                // 清除选择
                selection.removeAllRanges();
                
                showMessage(`已设置选中文本的字体颜色为 ${color}`, 2000, "info");
            } catch (error) {
                // 如果surroundContents失败，尝试另一种方法
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
                
                // 清除选择
                selection.removeAllRanges();
                
                showMessage(`已设置选中文本的字体颜色为 ${color}`, 2000, "info");
            }
        } catch (error) {
            console.error('设置字体颜色时出错:', error);
            showMessage('设置字体颜色失败', 2000, "error");
        }
    }

    private async showYoudaoDict() {
        // 获取当前选中的文本
        const selection = window.getSelection();
        let selectedText = '';
        
        if (selection && selection.rangeCount > 0) {
            selectedText = selection.toString().trim();
        }
        
        // 如果没有选中文本，尝试获取剪贴板内容
        if (!selectedText) {
            try {
                selectedText = await navigator.clipboard.readText();
                selectedText = selectedText.trim();
            } catch (error) {
                console.error('无法读取剪贴板:', error);
                showMessage('请先选择文本或确保剪贴板中有内容', 2000, "warning");
                return;
            }
        }
        
        if (!selectedText) {
            showMessage('请先选择要查询的文本', 2000, "warning");
            return;
        }

        // 构建有道词典URL，将hope替换为选中的文本
        const dictUrl = `https://www.youdao.com/result?word=${encodeURIComponent(selectedText)}&lang=en`;
        
        // 在默认浏览器中打开URL
        window.open(dictUrl, '_blank');
        
        showMessage(`正在查询"${selectedText}"`, 2000, "info");
    }

    private async showRhymeViewerOld() {
        // 获取剪贴板内容
        let clipboardText = '';
        try {
            clipboardText = await navigator.clipboard.readText();
        } catch (error) {
            console.error('无法读取剪贴板:', error);
            showMessage('无法读取剪贴板内容', 2000, "error");
            return;
        }

        // 将剪贴板内容分解为字符数组，过滤掉空白字符
        const characters = Array.from(clipboardText.trim()).filter(char => char.trim() !== '');
        
        if (characters.length === 0) {
            showMessage('剪贴板内容为空或只包含空白字符', 2000, "warning");
            return;
        }

        let currentIndex = 0;

        // 创建押韵界面对话框
        const dialog = new Dialog({
            title: "押韵查看",
            content: `
                <div style="display: flex; height: 400px; gap: 10px; background: #1a1a1a; color: #ffffff;">
                    <div style="flex: 1; border: 1px solid #444; border-radius: 4px; background: #2a2a2a;">
                        <div style="background: #333; padding: 8px; border-bottom: 1px solid #444; font-weight: bold; color: #fff;">字符列表</div>
                        <div id="rhyme-char-list" style="padding: 8px; height: 350px; overflow-y: auto; background: #2a2a2a;">
                             ${characters.map((char, index) => 
                                 `<div class="rhyme-char-item" data-char="${char}" data-index="${index}" style="padding: 4px 8px; cursor: pointer; color: #fff; transition: background-color 0.2s;">${char}</div>`
                             ).join('')}
                         </div>
                    </div>
                    <div style="flex: 2; border: 1px solid #444; border-radius: 4px; background: #2a2a2a;">
                        <div style="background: #333; padding: 8px; border-bottom: 1px solid #444; font-weight: bold; color: #fff; display: flex; justify-content: space-between; align-items: center;">
                            <span>显示区域</span>
                            <div style="display: flex; gap: 5px;">
                                <button id="rhyme-prev-btn" style="background: #444; color: #fff; border: 1px solid #666; border-radius: 3px; padding: 4px 8px; cursor: pointer; font-size: 14px;">《</button>
                                <button id="rhyme-next-btn" style="background: #444; color: #fff; border: 1px solid #666; border-radius: 3px; padding: 4px 8px; cursor: pointer; font-size: 14px;">》</button>
                            </div>
                        </div>
                        <textarea id="rhyme-display-area" style="width: calc(100% - 16px); height: 342px; border: none; padding: 8px; resize: none; outline: none; font-family: monospace; background: #1a1a1a; color: #fff; font-size: 200px; line-height: 1.2; box-sizing: border-box; text-align: center;"></textarea>
                    </div>
                </div>
            `,
            width: "600px",
            height: "500px"
        });

        // 获取元素引用
        const charItems = dialog.element.querySelectorAll('.rhyme-char-item');
        const displayArea = dialog.element.querySelector('#rhyme-display-area') as HTMLTextAreaElement;
        const prevBtn = dialog.element.querySelector('#rhyme-prev-btn') as HTMLButtonElement;
        const nextBtn = dialog.element.querySelector('#rhyme-next-btn') as HTMLButtonElement;
        
        // 更新显示和高亮
        const updateDisplay = (index: number) => {
            if (index >= 0 && index < characters.length) {
                currentIndex = index;
                displayArea.value = characters[index];
                
                // 移除所有高亮
                charItems.forEach(item => {
                    (item as HTMLElement).style.backgroundColor = '';
                });
                
                // 高亮当前项
                const currentItem = charItems[index] as HTMLElement;
                if (currentItem) {
                    currentItem.style.backgroundColor = '#555';
                    currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        };
        
        // 初始显示第一个字符
        if (characters.length > 0) {
            updateDisplay(0);
        }
        
        // 添加点击事件监听
        charItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                updateDisplay(index);
            });
            
            // 添加悬停效果
            item.addEventListener('mouseenter', () => {
                if (index !== currentIndex) {
                    (item as HTMLElement).style.backgroundColor = '#444';
                }
            });
            
            item.addEventListener('mouseleave', () => {
                if (index !== currentIndex) {
                    (item as HTMLElement).style.backgroundColor = '';
                }
            });
        });
        
        // 前进后退按钮事件
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                updateDisplay(currentIndex - 1);
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (currentIndex < characters.length - 1) {
                updateDisplay(currentIndex + 1);
            }
        });
        
        // 按钮悬停效果
        [prevBtn, nextBtn].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = '#555';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = '#444';
            });
        });
    }
}
