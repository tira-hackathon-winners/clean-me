import estraverse from "estraverse";
import _ from "lodash";

import {
  IF_STATEMENT_TYPE,
  LOGICAL_EXPRESSION_TYPE,
  IDENTIFIER_TYPE,
  BINARY_EXPRESSION_TYPE,
  LITERAL_TYPE,
  VARIABLE_DECLARATION_TYPE,
  VARIABLE_DECLARATOR_TYPE
} from "./consts/types";

const operationsMap = {
  ">": "grater",
  "<": "smaller",
  "==": "equals",
  "===": "equals"
};

const deltas = [];

export default class EncapsulateConditions {
  static apply(syntaxTree) {
    let logicStatementsArray = [];
    let logicVars = [];

    estraverse.traverse(syntaxTree, {
      enter: (node, parent) => {
        if (
          node.type == IF_STATEMENT_TYPE &&
          node.test.type == LOGICAL_EXPRESSION_TYPE
        ) {
          const subNames = this.getAllVarsInNodeNames(node.test);
          if (node.loc) {
            logicStatementsArray.push({
              testLogic: node.test,
              ifNode: node,
              ifParent: parent,
              subVarsNames: subNames
            });
          }
        }
      }
    });

    logicStatementsArray.forEach(logicStatment => {
      deltas.push({
        start: logicStatment.ifNode.loc.start.line,
        end: logicStatment.ifNode.loc.end.line,
        description: "Encapsulate complex if statments to const variable"
      });

      var toAppend = {
        type: VARIABLE_DECLARATION_TYPE,
        declarations: [
          {
            type: VARIABLE_DECLARATOR_TYPE,
            id: {
              type: IDENTIFIER_TYPE,
              name: _.camelCase("check_" + logicStatment.subVarsNames.join("_"))
            },
            init: logicStatment.testLogic
          }
        ],
        kind: "const"
      };

      logicVars.push(toAppend);
    });

    const newTree = estraverse.replace(syntaxTree, {
      enter: (node, parent) => {
        if(node.loc) {
          if (
            node.type == IF_STATEMENT_TYPE &&
            node.test.type == LOGICAL_EXPRESSION_TYPE
          ) {
            const statment = logicStatementsArray.find(logicStatmentNode => {
              return (
                logicStatmentNode.ifNode.loc.start.line ==
                  node.loc.start.line &&
                logicStatmentNode.ifNode.loc.start.column ==
                  node.loc.start.column
              );
            });

            if (statment) {
              const logic = logicVars.find(logicVar => {
                return logicVar.declarations[0].init == statment.testLogic;
              });
              if (logic) {
                node.test = {
                  type: IDENTIFIER_TYPE,
                  name: logic.declarations[0].id.name
                };

                parent.body.splice(parent.body.indexOf(node), 0, logic);
              }
            }
          }
        }
      }
    });

    return newTree;
  }

  static getAllVarsInNodeNames(node) {
    let varsNames = [];
    estraverse.traverse(node, {
      enter: subnode => {
        if (subnode.type == IDENTIFIER_TYPE) {
          varsNames.push(subnode.name);
        }
        if (subnode.type == BINARY_EXPRESSION_TYPE && subnode.operator) {
          varsNames.push(operationsMap[subnode.operator]);
        }
        if (subnode.type == LITERAL_TYPE) {
          varsNames.push(subnode.value);
        }
      }
    });

    return varsNames;
  }

  static getAllDeltas() {
    return deltas;
  }
}