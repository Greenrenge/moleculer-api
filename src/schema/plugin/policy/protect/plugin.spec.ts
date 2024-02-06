import { getLogger } from "../../../../test";
import { ProtectPolicyPlugin } from "./plugin";

describe("Filter policy schema validation test", () => {
  const plugin = new ProtectPolicyPlugin({
    logger: getLogger(),
  });

  it("valid schema should be return true", () => {
    return expect(plugin.validateSchema(true)).toMatchObject([]);
  });

  it("invalid schema should be return errors", () => {
    return expect(plugin.validateSchema("12345" as any)).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          type: "boolean",
        }),
      ]),
    );
  });
});
