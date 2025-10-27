/**
 * This is a sample TypeScript file for testing Cire
 * It demonstrates various syntax elements
 */

interface User {
	id: number;
	name: string;
	email?: string;
}

class UserService {
	private users: User[] = [];

	constructor() {
		console.log("UserService initialized");
	}

	public addUser(user: User): void {
		this.users.push(user);
	}

	public findUser(id: number): User | undefined {
		return this.users.find((user) => user.id === id);
	}

	public getAllUsers(): User[] {
		return [...this.users];
	}
}

// Function examples
function createSampleUser(): User {
	return {
		id: 1,
		name: "John Doe",
		email: "john@example.com",
	};
}

const userService = new UserService();
const user = createSampleUser();
userService.addUser(user);

const foundUser = userService.findUser(1);
console.log("Found user:", foundUser);

// Arrow function
const greet = (name: string): string => {
	return `Hello, ${name}!`;
};

// Async function example
async function fetchData(url: string): Promise<any> {
	const response = await fetch(url);
	return response.json();
}

export { UserService, type User, greet };
