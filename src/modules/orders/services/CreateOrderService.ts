import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('The customer ID is invalid.');
    }

    const findProducts = await this.productsRepository.findAllById(
      products.map(product => ({ id: product.id })),
    );

    if (!findProducts || findProducts.length < products.length) {
      throw new AppError('The products IDs are invalid.');
    }

    findProducts.forEach(foundProduct => {
      const findProduct = products.find(
        product => product.id === foundProduct.id,
      );

      let quantity = 0;

      if (findProduct) {
        quantity = findProduct.quantity;
      }

      if (foundProduct.quantity - quantity < 0) {
        throw new AppError('The product is out of stock.');
      }
    });

    const updatedProducts = await this.productsRepository.updateQuantity(
      products,
    );

    if (!updatedProducts) {
      throw new AppError('The products are invalid or out of stock.');
    }

    const newProducts: Product[] = [];

    updatedProducts.map(product => {
      const newProduct = Object.assign(product);

      newProducts.push(newProduct);
    });

    const order = await this.ordersRepository.create({
      customer,
      products: products.map(product => ({
        product_id: product.id,
        price: findProducts.find(found => found.id === product.id)?.price || 0,
        quantity: product.quantity,
      })),
    });

    return order;
  }
}

export default CreateOrderService;
