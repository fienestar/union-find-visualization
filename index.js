const colors =  [
    "lightblue",
    "lightcoral",
    "lightgreen",
    "lightsalmon",
    "lightpink",
    "lightskyblue",
    "violet",
    "plum",
    "tomato",
    "lightsteelblue"
]
const begin = (Math.random() * 256) | 0

function colorOf(str) {
    let x = 0;
    for (let i = 0; i != str.length; ++i) {
        x = ((x << 5) - x) + str.charCodeAt(i);
        x |= 0;
    }
    return colors[(begin + x) % colors.length];
}

const drawSettings = {
    padding: 80,
    width: window.screen.availWidth,
    height: 500,
}

const line = d3.svg.line()
    .x(d => d.x)
    .y(d => d.y)

const tree = d3.layout.tree()
    .size([drawSettings.width - (2 * drawSettings.padding), drawSettings.height - (2 * drawSettings.padding)]);

function updateTrees(selector, tree_data_list) {
    d3.select(selector).select("svg").remove()

    if(tree_data_list.length == 0)
        return;

    const root = {
        name: "root",
        children: tree_data_list
    }

    const svg = d3.select(selector)
        .append("svg")
        .attr("width", drawSettings.width)
        .attr("height", drawSettings.height)

    const nodes = tree.nodes(root).filter(d => d != root)
    const begin = (root.y + root.children[0].y)/2

    svg.selectAll("path.link")
        .data(tree.links(nodes)).enter()
        .append("path")
        .attr("class", "link")
        .attr("d", d => line.y(d => d.y - begin)([d.source, d.target]))

    const node = svg.selectAll("svg.node")
        .data(nodes).enter()
        .append("g")
        .attr("transform", d => "translate(" + d.x + "," + (d.y - begin) + ")")

    node.append("circle")
        .attr("r", d => Math.max(40, d.name.length * 15))
        .style("fill", d => colorOf(d.name))
        .style("stroke-width", d => d.emphasis ? "7px" : "0px")
        .style("stroke", d => d.emphasis === true ? "rebeccapurple" : d.emphasis)

    node.append("svg:text")
        .attr("dx", 0)
        .attr("dy", 15)
        .attr("text-anchor", "middle")
        .text(d => d.name)
}

function updateArray(selector, array)
{

}

function visualize(uf)
{
    function dfs(node)
    {
        node.children = node._children
        for(const child of node._children)
            dfs(child)
    }
    const roots = Object.keys(uf.roots).map(name => uf.parent[name])
    roots.forEach(dfs)
    updateTrees("#union-find-tree", roots)
}

const click_listeners = []
function wait()
{
    if(next.skip){
        --next.skip;
        return new Promise(resolve => resolve())
    }
    else
        return new Promise(resolve => {
            click_listeners.push(resolve)
            document.getElementById("next-button").disabled = false
        })
}

async function moveNode(uf, node, to)
{
    const old_parent = uf.parent[node.name]

    if(old_parent == to)
        return;

    old_parent._children = old_parent._children.filter(v => v != node)
    to._children.push(node)
    uf.parent[node.name] = to
    delete uf.roots[node.name]

    await wait()
    visualize(uf)
}

async function pushProcess(process, color)
{
    const stack = document.getElementById("stack")
    stack.append(createCommandNode(">>".repeat(stack.children.length) + process, color))
}

async function popProcess()
{
    const stack = document.getElementById("stack")
    stack.removeChild(stack.children[stack.children.length - 1])
}

async function getParent(uf, node)
{
    if(node == uf.parent[node.name])
        return node
    else{
        await pushProcess(`get parent of ${node.name}`, "hotpink")
        await moveNode(uf, node, await getParent(uf, uf.parent[node.name]))
        await popProcess();
        return uf.parent[node.name]
    }
}

async function merge(uf, a, b)
{
    pushProcess(`merge ${a.name} ${b.name}`, "darkblue")
    a = await getParent(uf, a)
    b = await getParent(uf, b)
    popProcess();
    await moveNode(uf, a, b)
}

function createNode(uf, name)
{
    const node = {
        name,
        _children: [],
    }

    uf.roots[name] = true;
    uf.parent[name] = node

    return node;
}

async function test()
{
    const uf = {
        parent: {},
        roots: {}
    }

    const nodes = Array(10).fill(null).map((v,i) => createNode(uf, i.toString()))
    visualize(uf)

    await merge(uf, nodes[0], nodes[1])
    await merge(uf, nodes[1], nodes[2])
}

async function processCommand(command)
{
    let uf = processCommand.uf = processCommand.uf || { parent: {}, roots: {} };
    let nodes = processCommand.nodes = processCommand.nodes || {}
    let before = processCommand.before;
    let split = command.split(" ");

    const result =  await (processCommand.before = (async function() {
        await before;
        next();
        switch(split[0]){
            case "sample":
                if(split.length != 1)
                    return [0,`arguments.length of command "sample" must be 0`]
                uf = processCommand.uf = { parent: {}, roots: {} }
                nodes = processCommand.nodes = Array(10).fill(null).map((v,i) => createNode(uf, i.toString()))
                visualize(uf);
                return [1]
            case "merge":
                if(split.length != 3)
                    return [0,`arguments.length of command "merge" must be 2`]

                for(let i=1; i!=3; ++i)
                    if(!nodes[split[i]])
                        return [0,`unknown node: ${split[i]}`]
                await merge(uf, nodes[split[2]], nodes[split[1]])
                return [1]
            case "create":
                if(split.length != 2)
                    return [0,`arguments.length of command "create" must be 1`]
                if(nodes[split[1]])
                    return [0, `${split[1]} already exists`]
                nodes[split[1]] = createNode(uf, split[1])
                visualize(uf);
                return [1]
            case "parent":
                if(split.length != 2)
                    return [0,`arguments.length of command "parent" must be 1`]
                if(!nodes[split[1]])
                    return [0, `unknown node: ${split[1]}`]
                return [1, (await getParent(uf, nodes[split[1]])).name];
            case "reset":
                if(split.length != 1)
                    return [0,`arguments.length of command "reset" must be 0`]
                uf = processCommand.uf = { parent: {}, roots: {} }
                nodes = {}
                visualize(uf);
                return [1]
            default:
                return [0, `unknown command: ${split[0]}`]
        }
    })());
    
    next.skip = 0;
    return result;
}

function createCommandNode(text, color)
{
    const p = document.createElement("p")
    p.style.color = color;
    p.style.margin = "0";
    p.innerText = text;
    return p
}

function next()
{
    const button = document.getElementById("next-button")
    let skip = next.skip;
    skip += 1
    while(skip && click_listeners.length){
        click_listeners.shift()()
        --skip;
    }
    next.skip = skip
    if(!click_listeners.length)
        button.disabled = true
}

window.addEventListener("load", () => {
    const button = document.getElementById("next-button")
    button.addEventListener("click", next)
    const command_input = document.getElementById("command");
    const command_history = document.getElementById("command-history")
    command_input.addEventListener("keyup", e => {
        if(e.key == "Enter"){
            const value = command_input.value;
            command_input.value = ""
            value.split("\n").forEach(async line => {
                const result = await processCommand(line)
                command_history.prepend(createCommandNode("> " + line, "gray"))
                if(result[1])
                    command_history.prepend(createCommandNode(result[1], result[0] ? "green":"red"))
            })
        }
    })
    //test()
})
