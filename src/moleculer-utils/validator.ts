import Validator from "fastest-validator";
import PhoneNumber from "awesome-phonenumber";
import moment from "moment";

export const validator = new Validator();
export type ValidationErrorEntry = {
  type: string;
  field: string;
  message: string;
  expected?: any;
  actual?: any;
};

/*
// phone number validation
phoneNumber: {
  type: "phone",
  types: ["mobile", "fixed-line-or-mobile"], // default
  format: "international", // default
}
*/
validator.messages.phone = `The {field} field must be a valid phone number format.`;
validator.add("phone", ({ schema, messages }: any, field: any, context: any) => {
  context.PhoneNumber = PhoneNumber; // PhoneNumber is 3rd party library
  context.types = schema.types || ["mobile", "fixed-line-or-mobile"];
  context.format = schema.format || "international";
  return {
    // value: KR|1044776418 or 1044776418 or KR|+821044776418 or +8210...
    // when region code or the region number given, validate with region context
    // region number will take precedence over region code
    source: `
      if (typeof value === "string") {
        const tokens = value.trim().split("|");
        let countryCode = tokens.length > 1 ? tokens.shift() : undefined;
        const number = tokens.join("|").replace(/[^0-9+]/g, " ").split(" ").filter((s) => !!s).join("");
        if (number.startsWith("+")) countryCode = undefined;
        const phoneNumber = new context.PhoneNumber(number, countryCode);
        if (phoneNumber.isPossible() && context.types.includes(phoneNumber.getType())) {
          return phoneNumber.getNumber(context.format);
        }
      }
      ${validator.makeError({ type: "phone", actual: "value", messages })}
    `,
  };
});

/*
// datetime validation
startedAt: {
  type: "datetime,
  format: "YYYY-MM-DD",
}
 */
validator.messages.datetime = `The {field} field must be a [expected] format string.`;
validator.add("datetime", ({ schema, messages }: any, field: any, context: any) => {
  context.moment = moment;
  context.format = schema.format || undefined;
  return {
    source: `
      const v = context.moment(value, context.format);
      if (v.isValid()) {
        return context.format ? v.format(context.format) : v.toISOString();
      }
      ${validator.makeError({ type: "datetime", actual: "value", expected: "context.format", messages })}
    `,
  };
});
