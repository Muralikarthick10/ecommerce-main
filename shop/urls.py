from django.urls import path

from . import views

urlpatterns = [
    # HOME
    path("", views.home, name="home"),

    # SEARCH
    path("search/", views.search, name="search"),

    # CATEGORIES
    path("collections/", views.category_list, name="category_list"),
    path("collections/<slug:slug>/", views.category_detail, name="category_detail"),

    # PRODUCT
    path("product/<slug:slug>/", views.product_detail, name="product_detail"),

    # AUTH
    path("register/", views.register_view, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),

    # PROFILE
    path("profile/", views.profile_view, name="profile"),

    # CART
    path("cart/", views.cart_view, name="cart"),
    path("cart/add/<int:product_id>/", views.add_to_cart, name="add_to_cart"),
    path("cart/update/<int:product_id>/", views.cart_update, name="cart_update"),
    path("cart/remove/<int:product_id>/", views.cart_remove, name="cart_remove"),

    # WISHLIST
    path("wishlist/", views.wishlist_view, name="wishlist"),
    path("wishlist/toggle/<int:product_id>/", views.wishlist_toggle, name="wishlist_toggle"),

    # CHECKOUT & ORDERS
    path("checkout/", views.checkout, name="checkout"),
    path("orders/", views.order_list, name="order_list"),
    path("orders/<int:order_id>/", views.order_detail, name="order_detail"),
]



