import React from 'react';
import Quantity from './quantity-control';
import Carousel from './carousel';

export default class ProductDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      product: null,
      images: [],
      quantity: 1,
      mainImage: ''
    };
    this.setView = this.setView.bind(this);
    this.handleClickAddToCart = this.handleClickAddToCart.bind(this);
    this.handleClickQuantityIncrease = this.handleClickQuantityIncrease.bind(this);
    this.handleClickQuantityDecrease = this.handleClickQuantityDecrease.bind(this);
    this.handleClickSelectMainImage = this.handleClickSelectMainImage.bind(this);
  }

  handleClickAddToCart() {
    this.props.add(this.state.product, this.state.quantity);
  }

  convertPrice(rawPrice) {
    const price = '' + rawPrice;
    let convertedPrice = '$';
    if (price.length < 4) {
      for (let i = 0; i < (price.length - 2); i++) {
        convertedPrice += (price[i] + '.');
        convertedPrice += price.slice(0, 2);
      }
    } else if (price.length > 4) {
      convertedPrice += (price.slice(0, -2) + '.' + price.slice(-2));
    } else {
      convertedPrice += (price.slice(0, 2) + '.' + price.slice(2, 4));
    }
    return convertedPrice;
  }

  handleClickQuantityIncrease() {
    const quantityIncrease = this.state.quantity;
    this.setState({
      quantity: (quantityIncrease + 1)
    });
  }

  handleClickQuantityDecrease() {
    const quantityIncrease = this.state.quantity;
    if (this.state.quantity > 0) {
      this.setState({
        quantity: (quantityIncrease - 1)
      });
    }
  }

  handleClickSelectMainImage(path) {
    this.setState({
      mainImage: path
    });
  }

  componentDidMount() {
    fetch(`/api/products/${this.props.viewParams.productId}`)
      .then(response => response.json())
      .then(data => {
        const imageArray = data.image.split(',');
        this.setState({
          product: data,
          images: imageArray,
          mainImage: imageArray[0]
        });
      })
      .catch(error => {
        console.error('There was a problem with your fetch GET operation: ', error);
      });
  }

  setView(e) {
    this.props.view('catalog', {});
  }

  render() {
    if (!this.state.product) return null;
    return (
      <div className="container container-iphone-678-landscape mt-3 mb-5">
        <div className="col-sm-5 pt-3 pl-3 spacing" style={{ cursor: 'pointer' }}>
          <p className="pointer" onClick={this.setView}><i className="fas fa-chevron-circle-left"></i> Back to catalog</p>
        </div>
        <div className="d-flex flex-wrap justify-content-between">
          <div className="card col-sm col-md-7 col-lg d-flex justify-content-around detail-image-display-container">
            <div className=" d-flex fade-in">
              <img className="col-12 detail-image-display align-self-center slide-in" src={this.state.mainImage} alt="" />
            </div>
            <div>
              <Carousel images={this.state.images} selectMainImage={this.handleClickSelectMainImage} />
            </div>
          </div>
          <div className="card col-sm col-md-5 col-lg-4 d-flex flex-wrap flex-column justify-content-center py-4 px-0">
            <div className="px-4">
              <h2>{this.state.product.name}</h2>
              <h3 className="mt-3">{this.convertPrice(this.state.product.price)}</h3>
              <p> {this.state.product.shortDescription}</p>
              <div className="mt-4">
                <Quantity
                  handleClickIncrease={this.handleClickQuantityIncrease}
                  handleClickDecrease={this.handleClickQuantityDecrease}
                  quantity={this.state.quantity} />
              </div>

              <button className="btn px-2 mt-4 btn-primary blue-button"
                onClick={this.handleClickAddToCart}>
                Add to Cart
              </button>
            </div>
            <div className="mt-5 d-flex justify-content-around">
              <div className="col-4 d-flex flex-wrap justify-content-center py-3">
                <i className="fas fa-clock fa-2x mb-3 grey"></i>
                <h4 className="col-12 p-0 text-center">{this.state.product.mins}</h4>
                <p>Minutes</p>
              </div>
              <div className="col-4 d-flex flex-wrap justify-content-center py-3 border-left border-right">
                <i className="fas fa-user-friends fa-2x mb-3 grey "></i>
                <h4 className="col-12 p-0 text-center">{this.state.product.players}</h4>
                <p>Players</p>
              </div>
              <div className="col-4 d-flex flex-wrap justify-content-center py-3">
                <i className="fas fa-user-astronaut fa-2x mb-3 grey"></i>
                <h4 className="col-12 p-0 text-center iphone-678-landscape">{this.state.product.ages}</h4>
                <p>Ages</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }
}
