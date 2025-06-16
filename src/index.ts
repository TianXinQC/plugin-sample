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

        let currentNotebooks: any[] = [];
        let currentLevel2Docs: any[] = [];
        let currentLevel3Docs: any[] = [];
        let currentLevel4Docs: any[] = [];
        
        // 加载保存的状态
        const savedStatePromise = this.loadData(TREE_STATE_STORAGE);
        console.log('加载的保存状态:', savedStatePromise);
        const savedState = await savedStatePromise || {};
        console.log('解析后的保存状态:', savedState);
        let currentNotebookId = savedState.currentNotebookId || '';
        let currentLevel2DocPath = savedState.currentLevel2DocPath || '';
        let currentLevel3DocPath = savedState.currentLevel3DocPath || '';
        let currentLevel4DocPath = savedState.currentLevel4DocPath || '';
        console.log('当前状态变量:', {
            currentNotebookId,
            currentLevel2DocPath,
            currentLevel3DocPath,
            currentLevel4DocPath
        });

        // 保存状态的函数
        const saveCurrentState = () => {
            this.saveData(TREE_STATE_STORAGE, {
                currentNotebookId,
                currentLevel2DocPath,
                currentLevel3DocPath,
                currentLevel4DocPath,
                notebooks: currentNotebooks,
                level2Docs: currentLevel2Docs,
                level3Docs: currentLevel3Docs,
                level4Docs: currentLevel4Docs
            });
            console.log('状态已保存:', {
                currentNotebookId,
                currentLevel2DocPath,
                currentLevel3DocPath,
                currentLevel4DocPath
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
        
        const onNotebookClick = (notebook: any) => {
            console.log('选中笔记本:', notebook.name, notebook.id);
            currentNotebookId = notebook.id;
            const savedLevel2Path = (notebook.id === savedState.currentNotebookId) ? savedState.currentLevel2DocPath : undefined;
            this.loadDocuments(notebook.id, level2Container, level3Container, level4Container, currentLevel2Docs, currentLevel3Docs, currentLevel4Docs, onLevel2DocClick, savedLevel2Path);
        };
        
        const onLevel2DocClick = (doc: any) => {
            currentLevel2DocPath = doc.path;
            if (doc.subFileCount > 0) {
                const savedLevel3Path = (doc.path === savedState.currentLevel2DocPath) ? savedState.currentLevel3DocPath : undefined;
                this.loadSubDocuments(currentNotebookId, doc.path, level3Container, level4Container, currentLevel3Docs, currentLevel4Docs, onLevel3DocClick, savedLevel3Path);
            } else {
                level3Container.innerHTML = '<div style="color: #888; padding: 8px;">无子文档</div>';
                level4Container.innerHTML = '';
                currentLevel3Docs.length = 0;
                currentLevel4Docs.length = 0;
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
        
        const onLevel3DocClick = (doc: any) => {
            console.log('选中第3级文档:', doc);
            currentLevel3DocPath = doc.path;
            if (doc.subFileCount > 0) {
                const savedLevel4Path = (doc.path === savedState.currentLevel3DocPath) ? savedState.currentLevel4DocPath : undefined;
                this.loadLevel4Documents(currentNotebookId, doc.path, level4Container, currentLevel4Docs, onLevel4DocClick, savedLevel4Path);
            } else {
                level4Container.innerHTML = '<div style="color: #888; padding: 8px;">无更深层文档</div>';
                currentLevel4Docs.length = 0;
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
        
        const onLevel4DocClick = (doc: any) => {
            console.log('选中第4级文档:', doc);
            currentLevel4DocPath = doc.path;
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
            this.filterTreeItems(level2Container, search2.value, currentLevel2Docs, onLevel2DocClick);
        });

        search3.addEventListener("input", () => {
            this.filterTreeItems(level3Container, search3.value, currentLevel3Docs, onLevel3DocClick);
        });

        search4.addEventListener("input", () => {
            this.filterTreeItems(level4Container, search4.value, currentLevel4Docs, onLevel4DocClick);
        });

        // 加载笔记本列表
         this.loadNotebooks(level1Container, level2Container, level3Container, level4Container, currentNotebooks, currentLevel2Docs, currentLevel3Docs, currentLevel4Docs, onNotebookClick, savedState);
     }

     private async loadNotebooks(level1Container: HTMLDivElement, level2Container: HTMLDivElement, level3Container: HTMLDivElement, level4Container: HTMLDivElement, currentNotebooks: any[], currentLevel2Docs: any[], currentLevel3Docs: any[], currentLevel4Docs: any[], onNotebookClick: (notebook: any) => void, savedState: any) {
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
                 currentNotebooks.length = 0;
                 currentNotebooks.push(...data.data.notebooks);
                 this.renderTreeItems(level1Container, currentNotebooks, onNotebookClick);
                 
                 // 恢复之前的状态
                 if (savedState.currentNotebookId) {
                     const savedNotebook = currentNotebooks.find(nb => nb.id === savedState.currentNotebookId);
                     if (savedNotebook) {
                         // 自动点击之前选中的笔记本
                         setTimeout(() => {
                             onNotebookClick(savedNotebook);
                             // 添加选中状态的视觉反馈
                             const notebookElements = level1Container.querySelectorAll('div');
                             notebookElements.forEach((el, index) => {
                                 if (index < currentNotebooks.length && currentNotebooks[index].id === savedState.currentNotebookId) {
                                     el.classList.add('selected');
                                     (el as HTMLElement).style.background = '#0066cc';
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
                     path: '/'
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
                                    (el as HTMLElement).style.background = '#0066cc';
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
                     path: parentPath
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
                                    (el as HTMLElement).style.background = '#0066cc';
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
                     path: parentPath
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
                                    (el as HTMLElement).style.background = '#0066cc';
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
             
             const name = item.name || item.hPath || '未命名';
             const icon = item.icon || (item.subFileCount > 0 ? '📁' : '📄');
             
             itemElement.innerHTML = `
                 <div style="display: flex; align-items: center; gap: 8px;">
                     <span style="font-size: 16px;">${icon}</span>
                     <span style="flex: 1; color: #fff; font-size: 14px;">${name}</span>
                     ${item.subFileCount > 0 ? `<span style="color: #888; font-size: 12px;">(${item.subFileCount})</span>` : ''}
                 </div>
             `;
             
             itemElement.addEventListener('mouseenter', () => {
                 itemElement.style.background = '#4d4d4d';
             });
             
             itemElement.addEventListener('mouseleave', () => {
                 itemElement.style.background = '#3d3d3d';
             });
             
             itemElement.addEventListener('click', () => {
                 console.log('点击项目:', item);
                 // 移除其他选中状态
                 container.querySelectorAll('.selected').forEach(el => {
                     el.classList.remove('selected');
                     (el as HTMLElement).style.background = '#3d3d3d';
                 });
                 
                 // 添加选中状态
                 itemElement.classList.add('selected');
                 itemElement.style.background = '#0066cc';
                 
                 console.log('调用回调函数');
                 onItemClick(item);
             });
             
             container.appendChild(itemElement);
         });
     }

     private filterTreeItems(container: HTMLDivElement, searchTerm: string, items: any[], onItemClick: (item: any) => void) {
         const filteredItems = items.filter(item => {
             const name = item.name || item.hPath || '';
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
                size: {width: 300, height: 0},
                icon: "iconFiles",
                title: "文档目录",
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
            <svg class="block__logoicon"><use xlink:href="#iconFiles"></use></svg>文档目录
        </div>
        <span class="fn__flex-1 fn__space"></span>
        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ${adaptHotkey("⌘W")}"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__flex-1" style="padding: 8px;">
        <button class="b3-button b3-button--outline" style="width: 100%; margin-bottom: 8px;" id="openFileTreeDialog">
            <svg><use xlink:href="#iconFiles"></use></svg>
            打开文档目录
        </button>
        <div style="font-size: 12px; color: #888; text-align: center;">
            点击按钮打开完整的文档目录浏览器
        </div>
    </div>
</div>`;
                
                // 添加按钮点击事件
                const openBtn = dock.element.querySelector('#openFileTreeDialog');
                if (openBtn) {
                    openBtn.addEventListener('click', () => {
                        this.showFileTreeDialog();
                    });
                }
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
    }

    private contentMenuEvent({detail}: any) {
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

    private getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("please open doc first");
            return;
        }
        return editors[0];
    }
}
