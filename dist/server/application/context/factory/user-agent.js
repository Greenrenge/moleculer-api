"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAgentContextFactory = void 0;
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const express_useragent_1 = require("express-useragent");
const factory_1 = require("./factory");
let UserAgentContextFactory = /** @class */ (() => {
    class UserAgentContextFactory extends factory_1.APIRequestContextFactory {
        constructor(props, opts) {
            super(props);
            this.props = props;
            this.opts = _.defaultsDeep(opts || {}, UserAgentContextFactory.autoLoadOptions);
        }
        create({ headers }) {
            const { os, platform, browser, source, isMobile } = express_useragent_1.parse(headers["user-agent"] || "");
            return { os, platform, browser, source, isMobile };
        }
    }
    UserAgentContextFactory.key = "userAgent";
    UserAgentContextFactory.autoLoadOptions = {};
    return UserAgentContextFactory;
})();
exports.UserAgentContextFactory = UserAgentContextFactory;
//# sourceMappingURL=user-agent.js.map