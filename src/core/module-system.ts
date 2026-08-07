export type ChessModule = {
  init(host: object): void;
  destroy?(): void;
};

export type ModuleRegistry = Map<string, ChessModule>;

// 工厂函数：创建模块系统
function createModuleSystem() {
  const moduleMap = new Map<string, ChessModule>();
  const registryMap = new WeakMap<object, ModuleRegistry>();

  function register(name: string, module: ChessModule) {
    if (!moduleMap.has(name)) {
      moduleMap.set(name, module);
    }
  }

  function createRegistry(host: object) {
    if (registryMap.has(host)) return registryMap.get(host);
    const registry = new Map<string, ChessModule>();
    for (const [name, module] of moduleMap) {
      const instance = module.init(host);
      registry.set(name, instance ?? module);
    }
    registryMap.set(host, registry);
    return registry;
  }

  function destroyRegistry(host: object) {
    const registry = registryMap.get(host);
    if (!registry) return;
    for (const module of registry.values()) {
      if (typeof (module as { destroy?(): void }).destroy === "function") {
        (module as { destroy?(): void }).destroy?.();
      }
    }
    registry.clear();
    registryMap.delete(host);
  }

  return {
    register,
    createRegistry,
    destroyRegistry,
  };
}

// 导出 PGNView 模块系统
const PGNViewModules = createModuleSystem();
export function registerPGNViewModule(name: string, module: ChessModule) {
  PGNViewModules.register(name, module);
}
export function createPGNViewModuleRegistry(host: object) {
  return PGNViewModules.createRegistry(host);
}
export function destroyPGNViewModuleRegistry(host: object) {
  PGNViewModules.destroyRegistry(host);
}

// 导出 Tree 模块系统
const TreeModules = createModuleSystem();
export function registerTreeModule(name: string, module: ChessModule) {
  TreeModules.register(name, module);
}
export function createTreeModuleRegistry(host: object) {
  return TreeModules.createRegistry(host);
}
export function destroyTreeModuleRegistry(host: object) {
  TreeModules.destroyRegistry(host);
}
