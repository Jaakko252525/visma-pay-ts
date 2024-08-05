import { createHmac } from "crypto"

export interface Charge {
  order_number: string
  amount: number
  currency: string
  email: string | undefined
  payment_method: PaymentMethod
  customer: Customer | undefined
  products: Product[] | undefined
}

export interface CreateChargeBodyJson {
  version: string
  api_key: string
  order_number: string
  amount: string
  currency: string
  payment_method: PaymentMethod
  authcode: string
  email: string | undefined
  customer: Customer | undefined
  products: Product[] | undefined
}

export interface PaymentMethod {
  type: string
  register_card_token: number | undefined
  return_url: string
  notify_url: string
  lang: string | undefined
  token_valid_until: number | undefined
  override_auto_settlement: number | undefined
  selected: string[] | undefined
}

export interface Customer {
  firstname: string
  lastname: string
  email: string
  address_street: string
  address_city: string
  address_zip: string
}

export interface Product {
  id: string
  title: string
  count: number
  pretax_price: number
  tax: number
  price: number
  type: number
}

export interface ChargeCardObject {
  order_number: string
  amount: number
  currency: string
  card_token: string
  email: string | undefined
  customer: Customer | undefined
  products: Product[] | undefined
  initiator: Initiator | undefined
}

export interface Initiator {
  type: InitiatorType | undefined
  return_url: string | undefined
  noitify_url: string | undefined
  lang: string | undefined
  browser_info: BrowserInfo | undefined
}

export enum InitiatorType {
  "Merchant initiated transaction (MIT)" = 1,
  "Customer initiated transaction (CIT)" = 2,
}

export interface BrowserInfo {
  accept_header: string | undefined
  java_enabled: number | undefined
  language: string | undefined
  color_depth: number | undefined
  screen_height: number | undefined
  screen_width: number | undefined
  timezone_offset: number | undefined
  user_agent: string | undefined
}

export interface Refund {
  order_number: string
  email: string | undefined
  amount: string | undefined
  products: RefundProduct[] | undefined
  notify_url: string | undefined
}

export interface RefundProduct {
  product_id: number
  count: number
}

export enum VismaResult {
  SUCCESS = 0,
  VALIDATION_ERROR = 1,
  DUPLICATE_ORDER_NUMBER = 2,
  MAINTANANCE_BREAK = 10,
}

export enum VismaPayErrorType {
  MALFORMED_RESPONSE = 1,
  PRIVATE_KEY_NOT_SET = 2,
  INVALID_PARAMETERS = 3,
  PROTOCOL_ERROR = 4,
  MAC_CHECK_FAILED = 5,
  API_RETURNED_ERROR = 6,
}

class VismapayError {
  error: string
  type: number
  result: VismaResult | undefined

  constructor(error: string, type: VismaPayErrorType, result?: VismaResult) {
    this.error = error
    this.type = type
    this.result = result
  }

  errCode2Text(code: VismaPayErrorType) {
    switch (code) {
      case VismaPayErrorType.MALFORMED_RESPONSE:
        return "Malformed response from Visma Pay API"
      case VismaPayErrorType.PRIVATE_KEY_NOT_SET:
        return "Private key or api key not set"
      case VismaPayErrorType.INVALID_PARAMETERS:
        return "Invalid parameters"
      case VismaPayErrorType.PROTOCOL_ERROR:
        return "Protocol error"
      case VismaPayErrorType.MAC_CHECK_FAILED:
        return "MAC check failed"
      case VismaPayErrorType.API_RETURNED_ERROR:
        return "API returned an error"

      default:
        return "Unknown error code"
    }
  }
}

interface Paths {
  auth_payment: string
  status: string
  capture: string
  cancel: string
  charge_card_token: string
  get_card_token: string
  delete_card_token: string
  get_merchant_payment_methods: string
  get_payment: string
  get_refund: string
  create_refund: string
  cancel_refund: string
}

export class Vismapay {
  apiKey: string
  privateKey: string
  apiVersion: string
  merchantPaymentMethodsApiVersion: string
  defaultHost: string
  apiUrl: string
  useHttps: boolean
  paths: Paths

  constructor() {
    this.apiKey = ""
    this.privateKey = ""
    this.apiVersion = "w3.2"
    this.merchantPaymentMethodsApiVersion = "2"

    this.defaultHost = "www.vismapay.com"
    this.apiUrl = "https://www.vismapay.com/pbwapi"
    this.useHttps = true

    this.paths = {
      auth_payment: "/pbwapi/auth_payment",
      status: "/pbwapi/check_payment_status",
      capture: "/pbwapi/capture",
      cancel: "/pbwapi/cancel",
      charge_card_token: "/pbwapi/charge_card_token",
      get_card_token: "/pbwapi/get_card_token",
      delete_card_token: "/pbwapi/delete_card_token",
      get_merchant_payment_methods: "/pbwapi/merchant_payment_methods",
      get_payment: "/pbwapi/get_payment",
      get_refund: "/pbwapi/get_refund",
      create_refund: "/pbwapi/create_refund",
      cancel_refund: "/pbwapi/cancel_refund",
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey
  }

  setPrivateKey(privateKey: string) {
    this.privateKey = privateKey
  }

  setApiVersion(version: string) {
    this.apiVersion = version
  }

  setDefaultHost(host: string) {
    this.defaultHost = host
  }

  setUseHttps(value: boolean) {
    this.useHttps = value
  }

  getHmac(data: string) {
    const hmac = createHmac("sha256", this.privateKey)
    return hmac.update(Buffer.from(data, "utf-8")).digest("hex").toUpperCase()
  }

  async doRequest(bodyJson: object, path: string) {
    const http = this.useHttps ? "https://" : "http://"

    const response = await fetch(http + this.defaultHost + path, {
      method: "POST",
      body: JSON.stringify(bodyJson),
      headers: { "Content-Type": "application/json" },
    })

    let data

    try {
      data = await response.json()
    } catch {
      throw new VismapayError(
        "Malformed response from Visma Pay API",
        VismaPayErrorType.MALFORMED_RESPONSE
      )
    }

    if (data.result !== undefined) {
      if (data.result === 0) {
        return data
      } else {
        throw new VismapayError("Error", 6, data)
      }
    } else {
      throw new VismapayError("Malformed response from Visma Pay API", 1)
    }
  }

  async createCharge(charge: Charge) {
    if (this.apiKey == "" || this.privateKey == "") {
      throw new VismapayError("Private key or api key not set", 2)
    }

    if (
      !charge ||
      !charge.amount ||
      !charge.currency ||
      !charge.order_number ||
      !charge.payment_method
    ) {
      throw new VismapayError("createCharge: Invalid parameters", 3)
    }

    const bodyJson: CreateChargeBodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      order_number: encodeURIComponent(charge.order_number),
      amount: encodeURIComponent(charge.amount),
      currency: encodeURIComponent(charge.currency),
      payment_method: charge.payment_method,
      authcode: encodeURIComponent(
        this.getHmac(this.apiKey + "|" + charge.order_number)
      ),
      email: undefined,
      customer: undefined,
      products: undefined,
    }

    if (charge.email) {
      bodyJson.email = charge.email
    }

    if (charge.customer) {
      bodyJson.customer = charge.customer
    }

    if (charge.products) {
      bodyJson.products = charge.products
    }

    return await this.doRequest(bodyJson, this.paths.auth_payment)
  }

  async checkStatusWithToken(token: string) {
    if (this.apiKey == "" || this.privateKey == "") {
      throw new VismapayError("Private key or api key not set", 2)
    }

    if (!token) {
      throw new VismapayError("checkStatusWithToken: token missing", 3)
    }

    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(this.getHmac(this.apiKey + "|" + token)),
      token: encodeURIComponent(token),
    }

    return await this.doRequest(bodyJson, this.paths.status)
  }

  async checkStatusWithOrderNumber(orderNumber: string) {
    if (this.apiKey == "" || this.privateKey == "") {
      throw new VismapayError("Private key or api key not set", 2)
    }

    if (!orderNumber) {
      throw new VismapayError(
        "checkStatusWithOrderNumber: order number missing",
        3
      )
    }

    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(
        this.getHmac(this.apiKey + "|" + orderNumber)
      ),
      order_number: encodeURIComponent(orderNumber),
    }

    return await this.doRequest(bodyJson, this.paths.status)
  }

  async capture(orderNumber: string) {
    if (!orderNumber) {
      throw new VismapayError("capture: order number missing", 3)
    }

    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(
        this.getHmac(this.apiKey + "|" + orderNumber)
      ),
      order_number: encodeURIComponent(orderNumber),
    }

    return await this.doRequest(bodyJson, this.paths.capture)
  }

  async cancel(orderNumber: string) {
    if (!orderNumber) {
      throw new VismapayError("cancel: order number missing", 3)
    }

    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(
        this.getHmac(this.apiKey + "|" + orderNumber)
      ),
      order_number: encodeURIComponent(orderNumber),
    }

    return await this.doRequest(bodyJson, this.paths.cancel)
  }

  async getCardToken(cardToken: string) {
    if (!cardToken) {
      throw new VismapayError("getCardToken: card token missing", 3)
    }

    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(this.getHmac(this.apiKey + "|" + cardToken)),
      card_token: encodeURIComponent(cardToken),
    }

    return await this.doRequest(bodyJson, this.paths.get_card_token)
  }

  async deleteCardToken(cardToken: string) {
    if (!cardToken) {
      throw new VismapayError("deleteCardToken: card token missing", 3)
    }
    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(this.getHmac(this.apiKey + "|" + cardToken)),
      card_token: encodeURIComponent(cardToken),
    }

    return await this.doRequest(bodyJson, this.paths.delete_card_token)
  }

  async checkReturn(params: object) {
    if (
      "RETURN_CODE" in params &&
      "AUTHCODE" in params &&
      "ORDER_NUMBER" in params
    ) {
      let macInput = params.RETURN_CODE + "|" + params.ORDER_NUMBER

      if ("SETTLED" in params) {
        macInput += "|" + params.SETTLED
      }

      if ("CONTACT_ID" in params) {
        macInput += "|" + params.CONTACT_ID
      }

      if ("INCIDENT_ID" in params) {
        macInput += "|" + params.INCIDENT_ID
      }

      const calculatedMac = this.getHmac(macInput)

      if (calculatedMac === params.AUTHCODE) {
        return Promise.resolve(true)
      }

      throw new VismapayError("checkReturn: MAC check failed", 5)
    }

    throw new VismapayError("checkReturn: Invalid parameters", 3)
  }

  async getPayment(orderNumber: string) {
    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(
        this.getHmac(this.apiKey + "|" + orderNumber)
      ),
      order_number: encodeURIComponent(orderNumber),
    }

    return await this.doRequest(bodyJson, this.paths.get_payment)
  }

  async getRefund(refundId: string) {
    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(this.getHmac(this.apiKey + "|" + refundId)),
      refund_id: encodeURIComponent(refundId),
    }

    return await this.doRequest(bodyJson, this.paths.get_refund)
  }

  async createRefund(refund: Refund) {
    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(
        this.getHmac(this.apiKey + "|" + refund.order_number)
      ),
      order_number: encodeURIComponent(refund.order_number),
      email: refund.email,
      notify_url: refund.notify_url,
      amount: refund.amount,
      products: refund.products,
    }

    if (refund.email) bodyJson.email = refund.email

    if (refund.notify_url) bodyJson.notify_url = refund.notify_url

    if (refund.amount) bodyJson.amount = encodeURIComponent(refund.amount)
    else bodyJson.products = refund.products

    return await this.doRequest(bodyJson, this.paths.create_refund)
  }

  async cancelRefund(refundId: number) {
    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      authcode: encodeURIComponent(this.getHmac(this.apiKey + "|" + refundId)),
      refund_id: encodeURIComponent(refundId),
    }

    return await this.doRequest(bodyJson, this.paths.cancel_refund)
  }

  async chargeCardToken(charge: ChargeCardObject) {
    if (this.apiKey == "" || this.privateKey == "") {
      throw new VismapayError("Private key or api key not set", 2)
    }

    if (!charge || !charge.amount || !charge.currency || !charge.card_token) {
      throw new VismapayError("createCharge: Invalid parameters", 3)
    }

    const bodyJson = {
      version: encodeURIComponent(this.apiVersion),
      api_key: encodeURIComponent(this.apiKey),
      order_number: encodeURIComponent(charge.order_number),
      amount: encodeURIComponent(charge.amount),
      currency: encodeURIComponent(charge.currency),
      card_token: encodeURIComponent(charge.card_token),
      authcode: encodeURIComponent(
        this.getHmac(
          this.apiKey + "|" + charge.order_number + "|" + charge.card_token
        )
      ),
      email: charge.email,
      customer: charge.customer,
      products: charge.products,
      initiator: charge.initiator,
    }

    if (charge.email) bodyJson.email = charge.email

    if (charge.customer) bodyJson.customer = charge.customer

    if (charge.products) bodyJson.products = charge.products

    if (charge.initiator) bodyJson.initiator = charge.initiator

    return await this.doRequest(bodyJson, this.paths.charge_card_token)
  }

  async getMerchantPaymentMethods(currency: string) {
    const bodyJson = {
      version: encodeURIComponent(this.merchantPaymentMethodsApiVersion),
      api_key: encodeURIComponent(this.apiKey),
      currency: encodeURIComponent(currency),
      authcode: encodeURIComponent(this.getHmac(this.apiKey)),
    }

    return await this.doRequest(
      bodyJson,
      this.paths.get_merchant_payment_methods
    )
  }
}
