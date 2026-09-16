import {describeOperation, listOperations} from '../shared/operation-discovery.js';
import {agentRecipes, renderRecipe} from '../shared/agent-recipes.js';

const failure = (code, message) => Object.assign(new Error(message), {code});
export function discoveryCommand(command, args) {
  if (command === 'operations') {
    if (!args.length || (args.length === 1 && args[0] === 'list')) return {operations: listOperations()};
    if (args.length !== 2 || args[0] !== 'inspect') throw failure('invalid_input', 'Use atrax operations list or atrax operations inspect <name>.');
    const operation = describeOperation(args[1]);
    if (!operation) throw failure('operation_not_found', `Unknown operation: ${args[1]}. Run atrax operations list.`);
    return {operation};
  }
  if (!args.length || (args.length === 1 && args[0] === 'list')) return {recipes: agentRecipes.map(({id, title, description}) => ({id, title, description}))};
  if (args.length !== 2 || args[0] !== 'show') throw failure('invalid_input', 'Use atrax recipes list or atrax recipes show <id>.');
  const recipe = agentRecipes.find(value => value.id === args[1]);
  if (!recipe) throw failure('recipe_not_found', `Unknown recipe: ${args[1]}. Run atrax recipes list.`);
  return {recipe};
}

export function discoverySummary(result) {
  if (result.recipe) return renderRecipe(result.recipe).trimEnd();
  if (result.recipes) return result.recipes.map(recipe => `${recipe.id}\t${recipe.title}`).join('\n');
  if (result.operations) return ['Operation\tEffect\tScope\tMCP', ...result.operations.map(operation => `${operation.name}\t${operation.effect}\t${operation.scope.kind}\t${operation.mcp.available ? 'available' : 'identity flow'}`)].join('\n');
  return JSON.stringify(result.operation, null, 2);
}
