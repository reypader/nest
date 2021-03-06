"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const optional = require("optional");
const iterare_1 = require("iterare");
const microservices_module_1 = require("./microservices-module");
const constants_1 = require("@nestjs/core/constants");
const logger_service_1 = require("@nestjs/common/services/logger.service");
const server_factory_1 = require("./server/server-factory");
const transport_enum_1 = require("./enums/transport.enum");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const nest_application_context_1 = require("@nestjs/core/nest-application-context");
const { SocketModule } = optional('@nestjs/websockets/socket-module') || {};
const { IoAdapter } = optional('@nestjs/websockets/adapters/io-adapter') || {};
class NestMicroservice extends nest_application_context_1.NestApplicationContext {
    constructor(container, config = {}, applicationConfig) {
        super(container, [], null);
        this.applicationConfig = applicationConfig;
        this.logger = new logger_service_1.Logger(NestMicroservice.name, true);
        this.microservicesModule = new microservices_module_1.MicroservicesModule();
        this.socketModule = SocketModule ? new SocketModule() : null;
        this.isTerminated = false;
        this.isInitialized = false;
        this.isInitHookCalled = false;
        this.registerWsAdapter();
        this.microservicesModule.register(container, this.applicationConfig);
        this.createServer(config);
        this.selectContextModule();
    }
    registerWsAdapter() {
        const ioAdapter = IoAdapter ? new IoAdapter() : null;
        this.applicationConfig.setIoAdapter(ioAdapter);
    }
    createServer(config) {
        try {
            this.microserviceConfig = Object.assign({ transport: transport_enum_1.Transport.TCP }, config);
            const { strategy } = config;
            this.server = strategy
                ? strategy
                : server_factory_1.ServerFactory.create(this.microserviceConfig);
        }
        catch (e) {
            this.logger.error(e);
            throw e;
        }
    }
    registerModules() {
        return __awaiter(this, void 0, void 0, function* () {
            this.socketModule &&
                this.socketModule.register(this.container, this.applicationConfig);
            this.microservicesModule.setupClients(this.container);
            this.registerListeners();
            this.setIsInitialized(true);
            !this.isInitHookCalled && (yield this.callInitHook());
        });
    }
    registerListeners() {
        this.microservicesModule.setupListeners(this.container, this.server);
    }
    useWebSocketAdapter(adapter) {
        this.applicationConfig.setIoAdapter(adapter);
        return this;
    }
    useGlobalFilters(...filters) {
        this.applicationConfig.useGlobalFilters(...filters);
        return this;
    }
    useGlobalPipes(...pipes) {
        this.applicationConfig.useGlobalPipes(...pipes);
        return this;
    }
    useGlobalInterceptors(...interceptors) {
        this.applicationConfig.useGlobalInterceptors(...interceptors);
        return this;
    }
    useGlobalGuards(...guards) {
        this.applicationConfig.useGlobalGuards(...guards);
        return this;
    }
    listen(callback) {
        !this.isInitialized && this.registerModules();
        this.logger.log(constants_1.messages.MICROSERVICE_READY);
        this.server.listen(callback);
    }
    listenAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Promise(resolve => this.listen(resolve));
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.server.close();
            !this.isTerminated && (yield this.closeApplication());
        });
    }
    setIsInitialized(isInitialized) {
        this.isInitialized = isInitialized;
    }
    setIsTerminated(isTerminaed) {
        this.isTerminated = isTerminaed;
    }
    setIsInitHookCalled(isInitHookCalled) {
        this.isInitHookCalled = isInitHookCalled;
    }
    closeApplication() {
        return __awaiter(this, void 0, void 0, function* () {
            this.socketModule && (yield this.socketModule.close());
            yield this.callDestroyHook();
            this.setIsTerminated(true);
        });
    }
    callInitHook() {
        return __awaiter(this, void 0, void 0, function* () {
            const modules = this.container.getModules();
            yield Promise.all(iterare_1.default(modules.values()).map((module) => __awaiter(this, void 0, void 0, function* () { return yield this.callModuleInitHook(module); })));
            this.setIsInitHookCalled(true);
        });
    }
    callModuleInitHook(module) {
        return __awaiter(this, void 0, void 0, function* () {
            const components = [...module.routes, ...module.components];
            yield Promise.all(iterare_1.default(components)
                .map(([key, { instance }]) => instance)
                .filter(instance => !shared_utils_1.isNil(instance))
                .filter(this.hasOnModuleInitHook)
                .map((instance) => __awaiter(this, void 0, void 0, function* () { return yield instance.onModuleInit(); })));
        });
    }
    hasOnModuleInitHook(instance) {
        return !shared_utils_1.isUndefined(instance.onModuleInit);
    }
    callDestroyHook() {
        return __awaiter(this, void 0, void 0, function* () {
            const modules = this.container.getModules();
            yield Promise.all(iterare_1.default(modules.values()).map((module) => __awaiter(this, void 0, void 0, function* () { return yield this.callModuleDestroyHook(module); })));
        });
    }
    callModuleDestroyHook(module) {
        return __awaiter(this, void 0, void 0, function* () {
            const components = [...module.routes, ...module.components];
            yield Promise.all(iterare_1.default(components)
                .map(([key, { instance }]) => instance)
                .filter(instance => !shared_utils_1.isNil(instance))
                .filter(this.hasOnModuleDestroyHook)
                .map((instance) => __awaiter(this, void 0, void 0, function* () { return yield instance.onModuleDestroy(); })));
        });
    }
    hasOnModuleDestroyHook(instance) {
        return !shared_utils_1.isUndefined(instance.onModuleDestroy);
    }
}
exports.NestMicroservice = NestMicroservice;
