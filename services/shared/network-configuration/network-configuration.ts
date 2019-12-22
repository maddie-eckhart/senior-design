const uuidv4 = require('uuid/v4')
import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer'


/**
 * A configuration for a single machine in a computer network.
 * Basically functions as a vertex in a graph.
 */
@Serializable()
export class Machine {
    @JsonProperty()
    readonly version: number = 1 // simple sequential API versioning
    @JsonProperty()
    readonly machineId: string = uuidv4()
    /**
     * Unique software defined ip address
     */
    @JsonProperty()
    address: string
    /**
     * Name of docker image. TODO: replace this with an OSImage type?
     */
    @JsonProperty()
    imageName: string
    /**
     * List of ports to be opened
     * TOOD: allow ranges of ports to be opened
     */
    @JsonProperty()
    openPorts: number[]
    /**
     * Set of machines that are directly accessible from this machine
     */
    @JsonProperty({ onDeserialize: Machine.arrayToMap, onSerialize: Machine.mapToArray })
    private adjacentMachines: Map<string, Machine>

    constructor(address: string, imageName: string, openPorts: number[]) {
        this.address = address
        this.imageName = imageName
        this.openPorts = openPorts
        this.adjacentMachines = new Map<string, Machine>()
    }

    addAdjacentMachine(machine: Machine): void {
        const machineId = machine.machineId
        this.adjacentMachines.set(machineId, machine)
    }

    removeAdjacentMachine(machine: Machine): void {
        const machineId = machine.machineId
        this.removeAdjacentMachineById(machineId)
    }

    removeAdjacentMachineById(machineId: string): void {
        this.adjacentMachines.delete(machineId)
    }

    /**
     * @returns Array<Machine>
     */
    getAdjacentMachines(): Machine[] {
        return Array.from(this.adjacentMachines.values())
    }

    /**
     * Check if a link exists between this machine and
     * another machines
     * 
     * @param otherMachine
     * @returns Boolean
     */
    hasLink(otherMachine: Machine): Boolean {
        const otherMachineId = otherMachine.machineId
        return this.hasLinkById(otherMachineId)
    }

    /**
     * Check if a link exists between this machine and
     * another machines given
     * 
     * @param otherMachineId
     * @returns Boolean
     */
    hasLinkById(otherMachineId: string): Boolean {
        return this.adjacentMachines.has(otherMachineId)
    }

    /**
     * Serialze a Machine to JSON
     * Note: doesn't serialize circular links of machines
     * 
     * @returns Object
     */
    toJSON(): Object {
        return Object(serialize(this))
    }

    /**
     * Deserialize JSON to a Machine
     * @param jsonData
     * @returns Machine
     */
    static fromJSON(jsonData: Object): Machine {
        return deserialize(jsonData, Machine)
    }

    // Serialization helper
    private static mapToArray(map: Map<string, Machine>): Object[] {
        return Array
                .from(map.entries())
                .map(entry => {
                    const [_, machine] = entry
                    return Object.assign({}, machine)
                })
    }
    
    // Deserialization helper
    private static arrayToMap(array: Object[]): Map<string, Machine> {
        const result = new Map<string, Machine>()

        if (Object.keys(array).length == 0) {
            return result
        }

        for (const item of array) {
            const machine = Machine.fromJSON(item)
            result.set(machine.machineId, machine)
        }
    
        return result
    }
}


/**
 * Overarching definition of a computer network: an organized
 * collection of machines in a graph.
 */
@Serializable()
export class Network {
    @JsonProperty()
    readonly version: number = 1 // simple sequential API versioning
    @JsonProperty()
    readonly owner: string // TODO: replace this with a User type?
    /**
     * Unique identifier generated for the network
     */
    @JsonProperty()
    readonly networkId: string = uuidv4()
    @JsonProperty()
    networkName: string
    @JsonProperty()
    readonly createdAt: Date
    @JsonProperty()
    updatedAt: Date
    /**
     * Set of all machines in the network
     */
    @JsonProperty({ onDeserialize: Network.arrayToMap, onSerialize: Network.mapToArray })
    private machines: Map<string, Machine>

    private machineLinks: Set<string, string>

    constructor(owner: string, networkName: string) {
        this.owner = owner
        this.networkName = networkName
        this.machines = new Map<string, Machine>()

        const now = new Date()
        this.createdAt = now
        this.updatedAt = now
    }

    /**
     * Retrieve all machines in the network
     */
    getAllMachines(): Machine[] {
        return Array.from(this.machines.values())
    }

    /**
     * Add a new machine to the network.
     * Does nothing if the machine already exists in the network.
     * 
     * @param machine
     */
    addMachine(machine: Machine): void {
        const machineId = machine.machineId
        this.machines.set(machineId, machine)
        this.updatedAt = new Date()
    }

    /**
     * Remove a machine from a network. Also removes the machine
     * as an adjacent machine from the necessary machines.
     * Does nothing if the machine doesn't exist in the network
     * 
     * @param machine 
     */
    removeMachine(machine: Machine): void {
        const adjacentMachines = machine.getAdjacentMachines()

        const machineId = machine.machineId
        this.machines.delete(machineId)

        // Remove links between machine and other machines
        for (const adjacent of adjacentMachines) {
            // If the adjacent machine exists in the network,
            // remove `machine` as being adjacent to it
            const adjacentMachineId = adjacent.machineId
            if (this.machines.has(adjacentMachineId)) {
                adjacent.removeAdjacentMachine(machine)
            }
        }

        this.updatedAt = new Date()
    }

    /**
     * Create a link between two existing machines in the network.
     * Links are created in both directions.
     * If a machine doesn't exist in the network, it is added.
     * 
     * @param firstMachine
     * @param secondMachine 
     */
    addLink(firstMachine: Machine, secondMachine: Machine): void {
        if (!this.machines.has(firstMachine.machineId)) {
            this.addMachine(firstMachine)
        }
        if (!this.machines.has(secondMachine.machineId)) {
            this.addMachine(secondMachine)
        }

        firstMachine.addAdjacentMachine(secondMachine)
        secondMachine.addAdjacentMachine(firstMachine)

        this.updatedAt = new Date()
    }

    /**
     * Create a link between two existing machines in the network.
     * Links are created in both directions.
     * If a machine's id is not already in the network, the link is
     * not created.
     * 
     * @param firstMachineId 
     * @param secondMachineId 
     */
    addLinkById(firstMachineId: string, secondMachineId: string): void {
        const firstMachine = this.machines.get(firstMachineId)
        const secondMachine = this.machines.get(secondMachineId)

        if (firstMachine == undefined || secondMachine == undefined) {
            return
        }

        // Both machines exist, so carry out the link
        this.addLink(firstMachine, secondMachine)
    }

    /**
     * Break the link between two machines given their objects,
     * but keep both machines in the network
     * 
     * @param firstMachine
     * @param secondMachine 
     */
    removeLink(firstMachine: Machine, secondMachine: Machine): void {
        firstMachine.removeAdjacentMachine(secondMachine)
        secondMachine.removeAdjacentMachine(firstMachine)
        this.updatedAt = new Date()
    }

    /**
     * Break the link between two machines given their ids,
     * but keep both machines in the network.
     * Does nothing if either machine doesn't exist.
     * 
     * @param firstMachineId
     * @param secondMachineId
     */
    removeLinkById(firstMachineId: string, secondMachineId: string): void {
        const firstMachine = this.machines.get(firstMachineId)
        const secondMachine = this.machines.get(secondMachineId)

        // Check if these machines exist
        if (firstMachine != undefined && secondMachine != undefined) {
            this.removeLink(firstMachine, secondMachine)
        }
    }

    /**
     * Check if a link exists between two machines
     * 
     * @param firstMachine
     * @param secondMachine
     * @returns Boolean
     */
    hasLink(firstMachine: Machine, secondMachine: Machine): Boolean {
        return firstMachine.hasLink(secondMachine)
    }

    /**
     * Check if a link exists between two machines.
     * If one of the machines doesn't exist, this method returns false.
     * 
     * @param firstMachineId
     * @param secondMachineId
     */
    hasLinkById(firstMachineId: string, secondMachineId: string): Boolean {
        const firstMachine = this.machines.get(firstMachineId)
        const secondMachine = this.machines.get(secondMachineId)

        // Check if these machines exist
        if (firstMachine != undefined && secondMachine != undefined) {
            return this.hasLink(firstMachine, secondMachine)
        }

        return false
    }

    toJSON(): Object {
        return Object(serialize(this))
    }

    static fromJSON(jsonData: Object): Network {
        return deserialize(jsonData, Network)
    }

    // Serialization helper
    private static mapToArray(map: Map<string, Machine>): Object[] {
        return Array
                .from(map.entries())
                .map(entry => {
                    const [_, machine] = entry
                    return Object.assign({}, machine)
                })
    }
    
    // Deserialization helper
    private static arrayToMap(array: Object[]): Map<string, Machine> {
        const result = new Map<string, Machine>()

        if (Object.keys(array).length == 0) {
            return result
        }

        for (const item of array) {
            const machine = Machine.fromJSON(item)
            result.set(machine.machineId, machine)
        }
    
        return result
    }
}
